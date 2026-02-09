const prisma = require('../config/database');
const logger = require('../utils/logger');
const recoveryService = require('./failureRecovery.service');
const orderRoutingService = require('./orderRouting.service');

/**
 * Enhanced Order Routing Service with Failure Recovery
 * Wraps existing routing service with retry and recovery mechanisms
 */

/**
 * Route order with failure recovery
 */
async function routeOrderWithRecovery(orderId, orderData, options = {}) {
  let workflowId = null;
  
  try {
    // Create workflow state for tracking
    const workflow = await recoveryService.createWorkflowState(
      'vendor_routing',
      'order',
      orderId,
      'vendor_selection',
      { orderData, options },
      4 // total steps: selection, assignment, notification, confirmation
    );
    
    workflowId = workflow.id;

    // Step 1: Vendor selection
    await recoveryService.updateWorkflowHeartbeat(workflowId);
    const routingResult = await orderRoutingService.routeOrder(orderId, orderData, options);
    
    await recoveryService.updateWorkflowStep(workflowId, 'vendor_assignment', {
      selectedVendorId: routingResult.selectedVendorId,
      routingLogId: routingResult.routingLogId,
    });

    // Step 2: Create vendor assignment retry record
    await recoveryService.updateWorkflowHeartbeat(workflowId);
    const assignmentRetry = await recoveryService.createVendorAssignmentRetry(
      orderId,
      routingResult.selectedVendorId,
      routingResult.acceptanceId,
      120 // 2 hours deadline
    );
    
    await recoveryService.updateWorkflowStep(workflowId, 'vendor_notification', {
      assignmentRetryId: assignmentRetry.id,
    });

    // Step 3: Notify vendor (via queue)
    await recoveryService.updateWorkflowHeartbeat(workflowId);
    // Notification handled by queue system
    
    await recoveryService.updateWorkflowStep(workflowId, 'awaiting_confirmation', {
      notificationSent: true,
    });

    // Complete workflow
    await recoveryService.completeWorkflow(workflowId);

    return {
      ...routingResult,
      workflowId,
      assignmentRetryId: assignmentRetry.id,
    };
  } catch (error) {
    logger.error('Order routing with recovery failed', {
      orderId,
      error: error.message,
    });

    if (workflowId) {
      await recoveryService.failWorkflow(workflowId, error);
    }

    // Create order recovery state
    await recoveryService.createOrderRecoveryState(
      orderId,
      'PENDING',
      'vendor_assignment',
      error.message,
      { orderData, options }
    );

    throw error;
  }
}

/**
 * Route to next best vendor (after timeout/rejection)
 */
async function routeToNextVendor(orderId) {
  try {
    logger.info(`Routing order ${orderId} to next best vendor`);

    // Get order details
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
        retailer: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Get previous routing attempts
    const previousAttempts = await prisma.$queryRaw`
      SELECT vendor_id, attempt_number
      FROM vendor_assignment_retries
      WHERE order_id = ${orderId}
      ORDER BY attempt_number DESC
      LIMIT 1
    `;

    const attemptNumber = previousAttempts[0]?.attempt_number || 0;
    const maxAttempts = 5;

    if (attemptNumber >= maxAttempts) {
      logger.error(`Max routing attempts reached for order ${orderId}`);
      
      // Create recovery record
      await recoveryService.createOrderRecoveryState(
        orderId,
        order.status,
        'vendor_assignment',
        'Max routing attempts reached',
        { attemptNumber, maxAttempts }
      );
      
      return null;
    }

    // Get excluded vendor IDs (already tried)
    const excludedVendorIds = await prisma.$queryRaw`
      SELECT DISTINCT vendor_id
      FROM vendor_assignment_retries
      WHERE order_id = ${orderId}
    `;

    const excludedIds = excludedVendorIds.map(v => v.vendor_id);

    // Route to next vendor
    const orderData = {
      retailerId: order.retailerId,
      items: order.orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    const routingResult = await routeOrderWithRecovery(orderId, orderData, {
      excludeVendorIds: excludedIds,
      attemptNumber: attemptNumber + 1,
    });

    return routingResult;
  } catch (error) {
    logger.error(`Failed to route to next vendor for order ${orderId}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Handle vendor response (accept/reject)
 */
async function handleVendorResponse(orderId, vendorId, accepted, reason = null) {
  try {
    // Get current assignment retry record
    const assignment = await prisma.$queryRaw`
      SELECT id, routing_id, attempt_number
      FROM vendor_assignment_retries
      WHERE order_id = ${orderId}
      AND vendor_id = ${vendorId}
      AND status IN ('pending', 'in_progress')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!assignment || assignment.length === 0) {
      throw new Error('No pending assignment found');
    }

    const assignmentId = assignment[0].id;

    if (accepted) {
      // Mark as success
      await recoveryService.markVendorResponded(assignmentId, true);
      
      // Update order status
      await prisma.orders.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          vendorId,
          updatedAt: new Date(),
        },
      });

      logger.info(`Vendor ${vendorId} accepted order ${orderId}`);
    } else {
      // Mark as failed
      await recoveryService.markVendorResponded(assignmentId, false);
      
      // Route to next vendor
      await routeToNextVendor(orderId);
      
      logger.info(`Vendor ${vendorId} rejected order ${orderId}, routing to next vendor`);
    }
  } catch (error) {
    logger.error('Failed to handle vendor response', {
      orderId,
      vendorId,
      accepted,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Check and process vendor assignment timeouts
 */
async function processVendorAssignmentTimeouts() {
  try {
    const timedOutAssignments = await recoveryService.getTimedOutVendorAssignments();
    
    for (const assignment of timedOutAssignments) {
      try {
        await recoveryService.markVendorTimeout(assignment.id);
        
        // Route to next vendor if attempts remaining
        if (assignment.attempt_number < assignment.max_attempts) {
          await routeToNextVendor(assignment.order_id);
        } else {
          // Create recovery record
          await recoveryService.createOrderRecoveryState(
            assignment.order_id,
            'PENDING',
            'vendor_assignment',
            'All vendor assignment attempts timed out',
            { lastVendorId: assignment.vendor_id }
          );
        }
      } catch (error) {
        logger.error(`Failed to process timeout for assignment ${assignment.id}`, {
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to process vendor assignment timeouts', {
      error: error.message,
    });
  }
}

module.exports = {
  routeOrderWithRecovery,
  routeToNextVendor,
  handleVendorResponse,
  processVendorAssignmentTimeouts,
};
