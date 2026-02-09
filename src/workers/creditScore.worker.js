const cron = require('node-cron');
const prisma = require('../config/database');
const creditScoringService = require('../services/creditScoring.service');
const logger = require('../utils/logger');

class CreditScoreWorker {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start daily credit score recalculation
   * Runs at 2:00 AM every day
   */
  start() {
    // Run at 2:00 AM daily
    cron.schedule('0 2 * * *', async () => {
      await this.recalculateAllScores();
    });

    logger.info('Credit score worker started - scheduled for 2:00 AM daily');
  }

  /**
   * Recalculate credit scores for all approved retailers
   */
  async recalculateAllScores() {
    if (this.isRunning) {
      logger.warn('Credit score recalculation already in progress');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting daily credit score recalculation');

      // Get all approved retailers
      const retailers = await prisma.retailer.findMany({
        where: {
          isApproved: true,
          deletedAt: null,
        },
        select: {
          id: true,
          retailerCode: true,
          shopName: true,
        },
      });

      logger.info(`Found ${retailers.length} retailers to process`);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process retailers in batches to avoid overwhelming the database
      const batchSize = 50;
      for (let i = 0; i < retailers.length; i += batchSize) {
        const batch = retailers.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (retailer) => {
            try {
              // Calculate new score
              const scoreData = await creditScoringService.calculateCreditScore(retailer.id);
              
              // Save to history
              await creditScoringService.saveScoreHistory(retailer.id, scoreData);
              
              successCount++;
              
              logger.debug('Credit score calculated', {
                retailerId: retailer.id,
                retailerCode: retailer.retailerCode,
                score: scoreData.score,
              });
            } catch (error) {
              errorCount++;
              errors.push({
                retailerId: retailer.id,
                retailerCode: retailer.retailerCode,
                error: error.message,
              });
              
              logger.error('Credit score calculation failed', {
                retailerId: retailer.id,
                retailerCode: retailer.retailerCode,
                error: error.message,
              });
            }
          })
        );

        // Small delay between batches
        if (i + batchSize < retailers.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Credit score recalculation completed', {
        totalRetailers: retailers.length,
        successCount,
        errorCount,
        durationMs: duration,
        durationMinutes: Math.round(duration / 60000),
      });

      if (errors.length > 0) {
        logger.warn('Credit score calculation errors', {
          errorCount: errors.length,
          errors: errors.slice(0, 10), // Log first 10 errors
        });
      }

    } catch (error) {
      logger.error('Credit score recalculation job failed', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Recalculate score for a single retailer
   * Used for on-demand recalculation
   */
  async recalculateRetailerScore(retailerId) {
    try {
      logger.info('Recalculating credit score for retailer', { retailerId });

      const scoreData = await creditScoringService.calculateCreditScore(retailerId);
      await creditScoringService.saveScoreHistory(retailerId, scoreData);

      logger.info('Credit score recalculated successfully', {
        retailerId,
        score: scoreData.score,
      });

      return scoreData;
    } catch (error) {
      logger.error('Credit score recalculation failed', {
        retailerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: '0 2 * * * (2:00 AM daily)',
    };
  }
}

module.exports = new CreditScoreWorker();
