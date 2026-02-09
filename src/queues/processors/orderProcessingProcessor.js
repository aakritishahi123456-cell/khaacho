const { PrismaClient } = require('@prisma/client');
const logger = require('../../utils/logger');
const { queueManager, QUEUES } = require('../queueManager');
const monitoringService = require('../../services/monitoring.service');

const prisma = new PrismaClient();

/**
 * Order Processing Processor
 * Handles order processing workflow with deduplication
 */
async function orderProcessingProcessor(job) {
  const { orderId, action, data } = job.data;

  logger.info(`Processing order job ${job.id}`, {
    orderId,
    action,
  });

  try {
    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        retailer: {
          include: { user: true },
        },
        vendor: {
          include: { user: true },
        },
        items: true,
      },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    let result;

    switch (action) {
      case 'CONFIRM':
        result = await handleOrderConfirmation(order);
        break;

      case 'ASSIGN_VENDOR':
        result = await handleVendorAssignment(order, data);
        break;

      case 'UPDATE_STATUS':
        result = await handleStatusUpdate(order, data);
        break;

      case 'COMPLETE':
        result = await handleOrderCompletion(order);
        break;

      case 'CANCEL':
        result = await handleOrderCancellation(order, data);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    logger.info(`Order processing job ${job.id} completed`, {
      orderId,
      action,
      result,
    });

    // Track job completion
    try {
      await monitoringService.trackJobCompleted('order-processing', job.id, true);
    } catch (error) {
      console.error('Failed to track job completion:', error.message);
    }

    return {
      success: true,
      orderId,
      action,
      result,
    };
  } catch (error) {
    logger.error(`Order processing job ${job.id} failed`, {
      error: error.message,
      orderId,
      action,
    });

    // Track job failure
    try {
      await monitoringService.trackJobCompleted('order-processing', job.id, false, error.message);
    } catch (monitorError) {
      console.error('Failed to track job failure:', monitorError.message);
    }

    throw error; // Will trigger retry
  }
}

/**
 * Handle order confirmation
 */
async function handleOrderConfirmation(order) {
  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  });

  // Send confirmation to retailer
  await queueManager.addJob(
    'WHATSAPP',
    'order-confirmation',
    {
      messageType: 'ORDER_CONFIRMATION',
      recipient: order.retailer.user.phoneNumber,
      data: {
        orderNumber: order.orderNumber,
        total: Number(order.total),
        items: order.items,
      },
    },
    {
      deduplicate: true,
      deduplicationKey: `order-confirmation-${order.id}`,
    }
  );

  // Trigger credit score recalculation
  await queueManager.addJob(
    'CREDIT_SCORE',
    'credit-score-calculation',
    {
      retailerId: order.retailerId,
      reason: 'order_confirmed',
    },
    {
      delay: 5000, // Delay 5 seconds
    }
  );

  return { status: 'CONFIRMED' };
}

/**
 * Handle vendor assignment
 */
async function handleVendorAssignment(order, data) {
  const { vendorId } = data;

  // Update order
  await prisma.order.update({
    where: { id: order.id },
    data: {
      vendorId,
      status: 'VENDOR_ASSIGNED',
    },
  });

  // Get vendor details
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: { user: true },
  });

  // Notify vendor
  await queueManager.addJob(
    'WHATSAPP',
    'vendor-notification',
    {
      messageType: 'VENDOR_NOTIFICATION',
      recipient: vendor.user.phoneNumber,
      data: {
        orderNumber: order.orderNumber,
        retailerName: order.retailer.user.businessName,
        total: Number(order.total),
        items: order.items,
      },
    },
    {
      deduplicate: true,
      deduplicationKey: `vendor-notification-${order.id}-${vendorId}`,
    }
  );

  return { status: 'VENDOR_ASSIGNED', vendorId };
}

/**
 * Handle status update
 */
async function handleStatusUpdate(order, data) {
  const { newStatus, notes } = data;

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: newStatus,
    },
  });

  // Log status change
  await prisma.orderStatusLog.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: newStatus,
      notes,
    },
  });

  // Send delivery update if applicable
  if (['DISPATCHED', 'DELIVERED'].includes(newStatus)) {
    await queueManager.addJob(
      'WHATSAPP',
      'delivery-update',
      {
        messageType: 'DELIVERY_UPDATE',
        recipient: order.retailer.user.phoneNumber,
        data: {
          orderNumber: order.orderNumber,
          status: newStatus,
          notes,
        },
      },
      {
        deduplicate: true,
        deduplicationKey: `delivery-update-${order.id}-${newStatus}`,
      }
    );
  }

  return { status: newStatus };
}

/**
 * Handle order completion
 */
async function handleOrderCompletion(order) {
  // Update order
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'COMPLETED',
      deliveredAt: new Date(),
    },
  });

  // Trigger credit score recalculation
  await queueManager.addJob(
    'CREDIT_SCORE',
    'credit-score-calculation',
    {
      retailerId: order.retailerId,
      reason: 'order_completed',
    },
    {
      delay: 10000, // Delay 10 seconds
    }
  );

  return { status: 'COMPLETED' };
}

/**
 * Handle order cancellation
 */
async function handleOrderCancellation(order, data) {
  const { reason } = data;

  // Update order
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  // Restore credit if used
  if (Number(order.creditUsed) > 0) {
    await prisma.retailer.update({
      where: { id: order.retailerId },
      data: {
        availableCredit: {
          increment: Number(order.creditUsed),
        },
      },
    });
  }

  return { status: 'CANCELLED', creditRestored: Number(order.creditUsed) };
}

module.exports = orderProcessingProcessor;
