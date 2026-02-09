const cron = require('node-cron');
const logger = require('../utils/logger');
const recoveryService = require('../services/failureRecovery.service');
const orderRoutingService = require('../services/orderRouting.service');
const queueManager = require('../queues/queueManager');

/**
 * Recovery Worker
 * Handles crash recovery, retry logic, and workflow resumption
 */

let isRunning = false;

/**
 * Process pending webhook events
 */
async function processPendingWebhookEvents() {
  try {
    const events = await recoveryService.getPendingWebhookEvents(50);
    
    if (events.length === 0) {
      return;
    }

    logger.info(`Processing ${events.length} pending webhook events`);

    for (const event of events) {
      try {
        await recoveryService.markWebhookProcessing(event.id);
        
        // Route to appropriate handler based on source
        if (event.source === 'whatsapp') {
          await queueManager.addJob('whatsapp', {
            eventId: event.id,
            eventType: event.event_type,
            payload: event.payload,
          });
        } else {
          // Add other webhook sources here
          logger.warn(`Unknown webhook source: ${event.source}`);
        }
        
        await recoveryService.markWebhookCompleted(event.id);
      } catch (error) {
        logger.error(`Failed to process webhook event ${event.id}`, {
          error: error.message,
        });
        await recoveryService.markWebhookFailed(event.id, error);
      }
    }
  } catch (error) {
    logger.error('Failed to process pending webhook events', {
      error: error.message,
    });
  }
}

/**
 * Retry failed webhook events
 */
async function retryFailedWebhookEvents() {
  try {
    const events = await recoveryService.getRetryableWebhookEvents(25);
    
    if (events.length === 0) {
      return;
    }

    logger.info(`Retrying ${events.length} failed webhook events`);

    for (const event of events) {
      try {
        await recoveryService.markWebhookProcessing(event.id);
        
        // Route to appropriate handler
        if (event.source === 'whatsapp') {
          await queueManager.addJob('whatsapp', {
            eventId: event.id,
            eventType: event.event_type,
            payload: event.payload,
            isRetry: true,
            retryCount: event.retry_count,
          });
        }
        
        await recoveryService.markWebhookCompleted(event.id);
      } catch (error) {
        logger.error(`Failed to retry webhook event ${event.id}`, {
          error: error.message,
          retryCount: event.retry_count,
        });
        await recoveryService.markWebhookFailed(event.id, error);
      }
    }
  } catch (error) {
    logger.error('Failed to retry webhook events', {
      error: error.message,
    });
  }
}

/**
 * Recover stuck webhook events
 */
async function recoverStuckWebhookEvents() {
  try {
    const events = await recoveryService.getStuckWebhookEvents(5);
    
    if (events.length === 0) {
      return;
    }

    logger.warn(`Found ${events.length} stuck webhook events`);

    for (const event of events) {
      // Reset to pending for retry
      await recoveryService.markWebhookFailed(event.id, new Error('Processing timeout'));
    }
  } catch (error) {
    logger.error('Failed to recover stuck webhook events', {
      error: error.message,
    });
  }
}

/**
 * Resume incomplete workflows
 */
async function resumeIncompleteWorkflows() {
  try {
    const workflows = await recoveryService.getIncompleteWorkflows();
    
    if (workflows.length === 0) {
      return;
    }

    logger.info(`Resuming ${workflows.length} incomplete workflows`);

    for (const workflow of workflows) {
      try {
        // Route to appropriate workflow handler
        switch (workflow.workflow_type) {
          case 'order_creation':
            await resumeOrderCreationWorkflow(workflow);
            break;
          case 'vendor_routing':
            await resumeVendorRoutingWorkflow(workflow);
            break;
          case 'payment_processing':
            await resumePaymentProcessingWorkflow(workflow);
            break;
          default:
            logger.warn(`Unknown workflow type: ${workflow.workflow_type}`);
        }
      } catch (error) {
        logger.error(`Failed to resume workflow ${workflow.id}`, {
          error: error.message,
          workflowType: workflow.workflow_type,
        });
        await recoveryService.failWorkflow(workflow.id, error);
      }
    }
  } catch (error) {
    logger.error('Failed to resume incomplete workflows', {
      error: error.message,
    });
  }
}

/**
 * Resume order creation workflow
 */
async function resumeOrderCreationWorkflow(workflow) {
  const { id, entity_id, current_step, step_data } = workflow;
  
  logger.info(`Resuming order creation workflow`, {
    workflowId: id,
    orderId: entity_id,
    currentStep: current_step,
  });

  // Queue for processing
  await queueManager.addJob('orderProcessing', {
    workflowId: id,
    orderId: entity_id,
    resumeFrom: current_step,
    stepData: step_data,
  });
}

/**
 * Resume vendor routing workflow
 */
async function resumeVendorRoutingWorkflow(workflow) {
  const { id, entity_id, current_step, step_data } = workflow;
  
  logger.info(`Resuming vendor routing workflow`, {
    workflowId: id,
    orderId: entity_id,
    currentStep: current_step,
  });

  // Queue for routing
  await queueManager.addJob('orderRouting', {
    workflowId: id,
    orderId: entity_id,
    resumeFrom: current_step,
    stepData: step_data,
  });
}

/**
 * Resume payment processing workflow
 */
async function resumePaymentProcessingWorkflow(workflow) {
  const { id, entity_id, current_step, step_data } = workflow;
  
  logger.info(`Resuming payment processing workflow`, {
    workflowId: id,
    paymentId: entity_id,
    currentStep: current_step,
  });

  // Queue for processing
  await queueManager.addJob('orderProcessing', {
    workflowId: id,
    paymentId: entity_id,
    resumeFrom: current_step,
    stepData: step_data,
  });
}

/**
 * Recover stale workflows
 */
async function recoverStaleWorkflows() {
  try {
    const workflows = await recoveryService.getStaleWorkflows(5);
    
    if (workflows.length === 0) {
      return;
    }

    logger.warn(`Found ${workflows.length} stale workflows`);

    for (const workflow of workflows) {
      // Mark as failed and create recovery record
      await recoveryService.failWorkflow(workflow.id, new Error('Workflow timeout - no heartbeat'));
      
      // Create order recovery if it's an order workflow
      if (workflow.entity_type === 'order') {
        await recoveryService.createOrderRecoveryState(
          workflow.entity_id,
          'PENDING',
          workflow.current_step,
          'Workflow timeout - no heartbeat',
          workflow.step_data
        );
      }
    }
  } catch (error) {
    logger.error('Failed to recover stale workflows', {
      error: error.message,
    });
  }
}

/**
 * Process timed out vendor assignments
 */
async function processTimedOutVendorAssignments() {
  try {
    const assignments = await recoveryService.getTimedOutVendorAssignments();
    
    if (assignments.length === 0) {
      return;
    }

    logger.info(`Processing ${assignments.length} timed out vendor assignments`);

    for (const assignment of assignments) {
      try {
        // Mark as timeout
        await recoveryService.markVendorTimeout(assignment.id);
        
        // If not max attempts, schedule retry with next vendor
        if (assignment.attempt_number < assignment.max_attempts) {
          logger.info(`Scheduling retry for order ${assignment.order_id}`, {
            attemptNumber: assignment.attempt_number + 1,
            maxAttempts: assignment.max_attempts,
          });
          
          // Route to next best vendor
          await orderRoutingService.routeToNextVendor(assignment.order_id);
        } else {
          // Max attempts reached, create recovery record
          logger.warn(`Max vendor assignment attempts reached for order ${assignment.order_id}`);
          
          await recoveryService.createOrderRecoveryState(
            assignment.order_id,
            'PENDING',
            'vendor_assignment',
            'All vendor assignment attempts failed',
            { lastVendorId: assignment.vendor_id }
          );
        }
      } catch (error) {
        logger.error(`Failed to process timed out assignment ${assignment.id}`, {
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to process timed out vendor assignments', {
      error: error.message,
    });
  }
}

/**
 * Process pending order recoveries
 */
async function processPendingOrderRecoveries() {
  try {
    const recoveries = await recoveryService.getPendingOrderRecoveries();
    
    if (recoveries.length === 0) {
      return;
    }

    logger.info(`Processing ${recoveries.length} pending order recoveries`);

    for (const recovery of recoveries) {
      try {
        // Route based on failure point
        switch (recovery.failure_point) {
          case 'vendor_assignment':
            // Retry vendor routing
            await orderRoutingService.routeOrder(recovery.order_id);
            await recoveryService.markOrderRecovered(recovery.id);
            break;
            
          case 'payment_processing':
            // Queue for payment retry
            await queueManager.addJob('orderProcessing', {
              orderId: recovery.order_id,
              action: 'retry_payment',
              recoveryData: recovery.recovery_data,
            });
            await recoveryService.markOrderRecovered(recovery.id);
            break;
            
          case 'inventory_update':
            // Queue for inventory retry
            await queueManager.addJob('orderProcessing', {
              orderId: recovery.order_id,
              action: 'retry_inventory',
              recoveryData: recovery.recovery_data,
            });
            await recoveryService.markOrderRecovered(recovery.id);
            break;
            
          default:
            logger.warn(`Unknown failure point: ${recovery.failure_point}`);
            await recoveryService.markOrderRecoveryFailed(recovery.id, new Error('Unknown failure point'));
        }
      } catch (error) {
        logger.error(`Failed to recover order ${recovery.order_id}`, {
          error: error.message,
          failurePoint: recovery.failure_point,
        });
        await recoveryService.markOrderRecoveryFailed(recovery.id, error);
      }
    }
  } catch (error) {
    logger.error('Failed to process pending order recoveries', {
      error: error.message,
    });
  }
}

/**
 * Run all recovery tasks
 */
async function runRecoveryTasks() {
  if (isRunning) {
    logger.warn('Recovery tasks already running, skipping');
    return;
  }

  isRunning = true;
  
  try {
    logger.info('Starting recovery tasks');

    // Process in order of priority
    await processPendingWebhookEvents();
    await retryFailedWebhookEvents();
    await recoverStuckWebhookEvents();
    await resumeIncompleteWorkflows();
    await recoverStaleWorkflows();
    await processTimedOutVendorAssignments();
    await processPendingOrderRecoveries();

    logger.info('Recovery tasks completed');
  } catch (error) {
    logger.error('Recovery tasks failed', {
      error: error.message,
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Run recovery on startup
 */
async function runStartupRecovery() {
  logger.info('Running startup recovery...');
  await runRecoveryTasks();
  logger.info('Startup recovery completed');
}

/**
 * Initialize recovery worker
 */
function initializeRecoveryWorker() {
  logger.info('Initializing recovery worker');

  // Run recovery on startup
  setTimeout(() => {
    runStartupRecovery();
  }, 5000); // Wait 5 seconds for system to stabilize

  // Schedule recovery tasks every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await runRecoveryTasks();
  });

  // Schedule cleanup daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running recovery tables cleanup');
    await recoveryService.runCleanup();
  });

  logger.info('Recovery worker initialized');
}

module.exports = {
  initializeRecoveryWorker,
  runRecoveryTasks,
  runStartupRecovery,
};
