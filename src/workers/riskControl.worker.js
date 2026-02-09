const cron = require('node-cron');
const prisma = require('../config/database');
const riskControlService = require('../services/riskControl.service');
const logger = require('../utils/logger');

class RiskControlWorker {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start automated risk control checks
   * Runs every hour
   */
  start() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
      await this.runRiskControls();
    });

    // Also run on payment events (triggered separately)
    logger.info('Risk control worker started - scheduled hourly');
  }

  /**
   * Run risk controls for all active retailers
   */
  async runRiskControls() {
    if (this.isRunning) {
      logger.warn('Risk control check already in progress');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting automated risk control checks');

      // Get all approved retailers with outstanding debt or recent activity
      const retailers = await prisma.retailer.findMany({
        where: {
          isApproved: true,
          deletedAt: null,
          OR: [
            { outstandingDebt: { gt: 0 } },
            { lastOrderAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          ],
        },
        select: {
          id: true,
          retailerCode: true,
          shopName: true,
          outstandingDebt: true,
        },
      });

      logger.info(`Found ${retailers.length} retailers to check`);

      let actionsCount = 0;
      let alertsCount = 0;
      const errors = [];

      // Process retailers in batches
      const batchSize = 20;
      for (let i = 0; i < retailers.length; i += batchSize) {
        const batch = retailers.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (retailer) => {
            try {
              // Apply automated controls
              const result = await riskControlService.applyAutomatedControls(retailer.id);
              
              if (result.actions && result.actions.length > 0) {
                actionsCount += result.actions.length;
                logger.info('Risk controls applied', {
                  retailerId: retailer.id,
                  retailerCode: retailer.retailerCode,
                  actionsCount: result.actions.length,
                });
              }

              // Count if high risk
              if (result.riskScore && result.riskScore.riskLevel === 'HIGH' || result.riskScore.riskLevel === 'CRITICAL') {
                alertsCount++;
              }
            } catch (error) {
              errors.push({
                retailerId: retailer.id,
                retailerCode: retailer.retailerCode,
                error: error.message,
              });
              
              logger.error('Risk control check failed', {
                retailerId: retailer.id,
                retailerCode: retailer.retailerCode,
                error: error.message,
              });
            }
          })
        );

        // Small delay between batches
        if (i + batchSize < retailers.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const duration = Date.now() - startTime;

      logger.info('Risk control checks completed', {
        totalRetailers: retailers.length,
        actionsCount,
        alertsCount,
        errorCount: errors.length,
        durationMs: duration,
        durationMinutes: Math.round(duration / 60000),
      });

      if (errors.length > 0) {
        logger.warn('Risk control check errors', {
          errorCount: errors.length,
          errors: errors.slice(0, 10),
        });
      }

    } catch (error) {
      logger.error('Risk control worker failed', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run risk controls for a specific retailer (on-demand)
   */
  async runForRetailer(retailerId) {
    try {
      logger.info('Running risk controls for retailer', { retailerId });

      const result = await riskControlService.applyAutomatedControls(retailerId);

      logger.info('Risk controls applied for retailer', {
        retailerId,
        riskScore: result.riskScore.riskScore,
        actionsCount: result.actions.length,
      });

      return result;
    } catch (error) {
      logger.error('Risk control check failed for retailer', {
        retailerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check risk controls after payment
   */
  async checkAfterPayment(retailerId) {
    try {
      logger.info('Checking risk controls after payment', { retailerId });

      // Recalculate risk score
      const riskScore = await riskControlService.calculateRetailerRiskScore(retailerId);

      // If risk improved significantly, consider restoring credit limit
      if (riskScore.riskLevel === 'LOW' || riskScore.riskLevel === 'MEDIUM') {
        await this._considerCreditLimitRestoration(retailerId, riskScore);
      }

      return riskScore;
    } catch (error) {
      logger.error('Post-payment risk check failed', {
        retailerId,
        error: error.message,
      });
    }
  }

  /**
   * Consider restoring credit limit if risk improved
   */
  async _considerCreditLimitRestoration(retailerId, riskScore) {
    // Get recent credit limit reductions
    const recentReduction = await prisma.riskAction.findFirst({
      where: {
        retailerId,
        actionType: 'CREDIT_LIMIT_REDUCED',
        createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentReduction) {
      return; // No recent reduction to restore
    }

    // Check if enough time has passed and risk is low
    const daysSinceReduction = Math.floor(
      (Date.now() - new Date(recentReduction.createdAt)) / (1000 * 60 * 60 * 24)
    );

    const creditLimitRules = await riskControlService.getRiskConfig('credit_limit_rules');
    const restoreDays = creditLimitRules?.auto_restore_after_days || 90;

    if (daysSinceReduction >= restoreDays && riskScore.riskScore < 30) {
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId },
      });

      const previousLimit = recentReduction.previousValue?.creditLimit;
      if (previousLimit && previousLimit > Number(retailer.creditLimit)) {
        // Restore credit limit
        await prisma.retailer.update({
          where: { id: retailerId },
          data: { creditLimit: previousLimit },
        });

        // Log action
        await prisma.riskAction.create({
          data: {
            actionType: 'CREDIT_LIMIT_RESTORED',
            retailerId,
            triggeredBy: 'RISK_IMPROVEMENT',
            previousValue: { creditLimit: Number(retailer.creditLimit) },
            newValue: { creditLimit: previousLimit },
            reason: `Credit limit restored after ${daysSinceReduction} days of improved risk score (${riskScore.riskScore})`,
            isAutomatic: true,
          },
        });

        // Create alert
        await prisma.riskAlert.create({
          data: {
            alertType: 'CREDIT_LIMIT_RESTORED',
            severity: 'LOW',
            retailerId,
            title: 'Credit Limit Restored',
            description: `Credit limit restored to ${previousLimit} due to improved risk score`,
            metadata: { riskScore: Number(riskScore.riskScore), daysSinceReduction },
          },
        });

        logger.info('Credit limit restored automatically', {
          retailerId,
          newLimit: previousLimit,
          riskScore: Number(riskScore.riskScore),
        });
      }
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: '0 * * * * (Every hour)',
    };
  }
}

module.exports = new RiskControlWorker();
