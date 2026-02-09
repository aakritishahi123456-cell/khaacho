const { queueManager } = require('./queueManager');
const whatsappProcessor = require('./processors/whatsappProcessor');
const creditScoreProcessor = require('./processors/creditScoreProcessor');
const orderRoutingProcessor = require('./processors/orderRoutingProcessor');
const paymentReminderProcessor = require('./processors/paymentReminderProcessor');
const reportGenerationProcessor = require('./processors/reportGenerationProcessor');
const orderProcessingProcessor = require('./processors/orderProcessingProcessor');
const logger = require('../utils/logger');

/**
 * Initialize all queues and register processors
 */
function initializeQueues() {
  try {
    logger.info('Initializing job queues...');

    // Initialize queue manager
    queueManager.initialize();

    // Register processors with concurrency settings
    queueManager.registerProcessor('WHATSAPP', whatsappProcessor, 5); // 5 concurrent WhatsApp messages
    queueManager.registerProcessor('CREDIT_SCORE', creditScoreProcessor, 2); // 2 concurrent calculations
    queueManager.registerProcessor('ORDER_ROUTING', orderRoutingProcessor, 3); // 3 concurrent routing operations
    queueManager.registerProcessor('PAYMENT_REMINDERS', paymentReminderProcessor, 3); // 3 concurrent reminders
    queueManager.registerProcessor('REPORT_GENERATION', reportGenerationProcessor, 1); // 1 report at a time (resource intensive)
    queueManager.registerProcessor('ORDER_PROCESSING', orderProcessingProcessor, 5); // 5 concurrent order operations

    logger.info('All job queues initialized successfully');

    return queueManager;
  } catch (error) {
    logger.error('Failed to initialize job queues', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Graceful shutdown of all queues
 */
async function shutdownQueues() {
  try {
    logger.info('Shutting down job queues...');
    await queueManager.closeAll();
    logger.info('All job queues shut down successfully');
  } catch (error) {
    logger.error('Error shutting down job queues', {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  initializeQueues,
  shutdownQueues,
};
