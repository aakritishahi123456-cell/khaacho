const creditScoringService = require('../../services/creditScoring.service');
const logger = require('../../utils/logger');
const monitoringService = require('../../services/monitoring.service');

/**
 * Credit Score Calculation Processor
 * Handles credit score recalculation asynchronously
 */
async function creditScoreProcessor(job) {
  const { retailerId, reason } = job.data;

  logger.info(`Processing credit score calculation job ${job.id}`, {
    retailerId,
    reason,
  });

  try {
    // Calculate credit score
    const result = await creditScoringService.calculateCreditScore(retailerId);

    logger.info(`Credit score calculation job ${job.id} completed`, {
      retailerId,
      newScore: result.score,
      previousScore: result.previousScore,
    });

    // Track job completion
    try {
      await monitoringService.trackJobCompleted('credit-score', job.id, true);
    } catch (error) {
      console.error('Failed to track job completion:', error.message);
    }

    return {
      success: true,
      retailerId,
      score: result.score,
      previousScore: result.previousScore,
      breakdown: result.breakdown,
    };
  } catch (error) {
    logger.error(`Credit score calculation job ${job.id} failed`, {
      error: error.message,
      retailerId,
    });

    // Track job failure
    try {
      await monitoringService.trackJobCompleted('credit-score', job.id, false, error.message);
    } catch (monitorError) {
      console.error('Failed to track job failure:', monitorError.message);
    }

    throw error; // Will trigger retry
  }
}

module.exports = creditScoreProcessor;
