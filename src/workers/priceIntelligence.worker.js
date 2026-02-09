const cron = require('node-cron');
const priceIntelligenceService = require('../services/priceIntelligence.service');
const logger = require('../utils/logger');

class PriceIntelligenceWorker {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start the price intelligence worker
   * Runs every 4 hours to update market analytics
   */
  start() {
    // Run every 4 hours: 0 */4 * * *
    this.cronJob = cron.schedule('0 */4 * * *', async () => {
      if (this.isRunning) {
        logger.warn('Price intelligence worker is already running, skipping this cycle');
        return;
      }

      this.isRunning = true;
      logger.info('Price intelligence worker started');

      try {
        const result = await priceIntelligenceService.updateAllMarketAnalytics();
        
        logger.info('Price intelligence worker completed', {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
        });
      } catch (error) {
        logger.error('Price intelligence worker failed', {
          error: error.message,
          stack: error.stack,
        });
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Price intelligence worker scheduled (runs every 4 hours)');

    // Run immediately on startup
    this.runNow();
  }

  /**
   * Run the worker immediately (for testing or manual trigger)
   */
  async runNow() {
    if (this.isRunning) {
      logger.warn('Price intelligence worker is already running');
      return { success: false, message: 'Worker is already running' };
    }

    this.isRunning = true;
    logger.info('Price intelligence worker triggered manually');

    try {
      const result = await priceIntelligenceService.updateAllMarketAnalytics();
      
      logger.info('Price intelligence worker completed (manual run)', {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
      });

      return { success: true, result };
    } catch (error) {
      logger.error('Price intelligence worker failed (manual run)', {
        error: error.message,
        stack: error.stack,
      });
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Price intelligence worker stopped');
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.cronJob !== null,
      schedule: '0 */4 * * * (every 4 hours)',
    };
  }
}

module.exports = new PriceIntelligenceWorker();
