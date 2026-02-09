const { orderQueue } = require('../queues');
const OrderLifecycleService = require('../services/orderLifecycle.service');
const CreditService = require('../services/credit.service');
const { orderLogger } = require('../utils/logger');

// Process order status updates
orderQueue.process('update-status', 5, async (job) => {
  const { orderId, status, userId } = job.data;
  
  try {
    orderLogger.info('Processing order status update', {
      jobId: job.id,
      orderId,
      status,
    });

    // Status update logic would go here
    // This is a placeholder for async order processing

    return { success: true };
  } catch (error) {
    orderLogger.error('Order status update failed', {
      jobId: job.id,
      orderId,
      error: error.message,
    });
    throw error;
  }
});

// Process credit score recalculation
orderQueue.process('recalculate-credit-score', 3, async (job) => {
  const { retailerId } = job.data;
  
  try {
    orderLogger.info('Recalculating credit score', {
      jobId: job.id,
      retailerId,
    });

    const score = await CreditService.calculateCreditScore(retailerId);
    
    orderLogger.info('Credit score recalculated', {
      jobId: job.id,
      retailerId,
      score,
    });

    return { success: true, score };
  } catch (error) {
    orderLogger.error('Credit score calculation failed', {
      jobId: job.id,
      retailerId,
      error: error.message,
    });
    throw error;
  }
});

// Process stock updates
orderQueue.process('update-stock', 10, async (job) => {
  const { vendorProductId, quantity, operation } = job.data;
  
  try {
    // Stock update logic
    orderLogger.info('Processing stock update', {
      jobId: job.id,
      vendorProductId,
      quantity,
      operation,
    });

    return { success: true };
  } catch (error) {
    orderLogger.error('Stock update failed', {
      jobId: job.id,
      vendorProductId,
      error: error.message,
    });
    throw error;
  }
});

orderLogger.info('Order worker started');

module.exports = orderQueue;
