const cron = require('node-cron');
const orderRoutingService = require('../services/orderRouting.service');
const logger = require('../utils/logger');

class OrderRoutingWorker {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start checking for expired acceptances
   * Runs every 15 minutes
   */
  start() {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      await this.checkExpiredAcceptances();
    });

    logger.info('Order routing worker started - checking every 15 minutes');
  }

  /**
   * Check for expired vendor acceptances and trigger fallback
   */
  async checkExpiredAcceptances() {
    if (this.isRunning) {
      logger.warn('Expired acceptance check already in progress');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Checking for expired vendor acceptances');

      const expiredCount = await orderRoutingService.checkExpiredAcceptances();

      const duration = Date.now() - startTime;

      logger.info('Expired acceptance check completed', {
        expiredCount,
        durationMs: duration,
      });

    } catch (error) {
      logger.error('Expired acceptance check failed', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: '*/15 * * * * (Every 15 minutes)',
    };
  }
}

module.exports = new OrderRoutingWorker();
