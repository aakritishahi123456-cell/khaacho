const cron = require('node-cron');
const vendorPerformanceService = require('../services/vendorPerformance.service');
const logger = require('../utils/logger');

class VendorPerformanceWorker {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  /**
   * Start the vendor performance worker
   * Runs every 6 hours to recalculate vendor performance metrics
   */
  start() {
    // Run every 6 hours: 0 */6 * * *
    this.cronJob = cron.schedule('0 */6 * * *', async () => {
      if (this.isRunning) {
        logger.warn('Vendor performance worker is already running, skipping this cycle');
        return;
      }

      this.isRunning = true;
      logger.info('Vendor performance worker started');

      try {
        const result = await vendorPerformanceService.recalculateAllVendors();
        
        logger.info('Vendor performance worker completed', {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
        });
      } catch (error) {
        logger.error('Vendor performance worker failed', {
          error: error.message,
          stack: error.stack,
        });
      } finally {
        this.isRunning = false;
      }
    });

    logger.info('Vendor performance worker scheduled (runs every 6 hours)');

    // Run immediately on startup
    this.runNow();
  }

  /**
   * Run the worker immediately (for testing or manual trigger)
   */
  async runNow() {
    if (this.isRunning) {
      logger.warn('Vendor performance worker is already running');
      return { success: false, message: 'Worker is already running' };
    }

    this.isRunning = true;
    logger.info('Vendor performance worker triggered manually');

    try {
      const result = await vendorPerformanceService.recalculateAllVendors();
      
      logger.info('Vendor performance worker completed (manual run)', {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
      });

      return { success: true, result };
    } catch (error) {
      logger.error('Vendor performance worker failed (manual run)', {
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
      logger.info('Vendor performance worker stopped');
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.cronJob !== null,
      schedule: '0 */6 * * * (every 6 hours)',
    };
  }
}

module.exports = new VendorPerformanceWorker();
