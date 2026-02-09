const creditScoringService = require('../services/creditScoring.service');
const creditScoreWorker = require('../workers/creditScore.worker');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

class CreditScoringController {
  /**
   * Get current credit score for a retailer
   * GET /api/v1/credit-scoring/:retailerId
   */
  async getRetailerScore(req, res) {
    try {
      const { retailerId } = req.params;

      const scoreData = await creditScoringService.calculateCreditScore(retailerId);

      return successResponse(res, scoreData, 'Credit score retrieved successfully');
    } catch (error) {
      logger.error('Get credit score error', {
        retailerId: req.params.retailerId,
        error: error.message,
      });
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get credit score history for a retailer
   * GET /api/v1/credit-scoring/:retailerId/history?days=90
   */
  async getScoreHistory(req, res) {
    try {
      const { retailerId } = req.params;
      const days = parseInt(req.query.days) || 90;

      const history = await creditScoringService.getScoreHistory(retailerId, days);

      return successResponse(res, history, 'Score history retrieved successfully');
    } catch (error) {
      logger.error('Get score history error', {
        retailerId: req.params.retailerId,
        error: error.message,
      });
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get credit score trend for a retailer
   * GET /api/v1/credit-scoring/:retailerId/trend?days=30
   */
  async getScoreTrend(req, res) {
    try {
      const { retailerId } = req.params;
      const days = parseInt(req.query.days) || 30;

      const trend = await creditScoringService.getScoreTrend(retailerId, days);

      return successResponse(res, trend, 'Score trend retrieved successfully');
    } catch (error) {
      logger.error('Get score trend error', {
        retailerId: req.params.retailerId,
        error: error.message,
      });
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Recalculate credit score for a retailer (admin only)
   * POST /api/v1/credit-scoring/:retailerId/recalculate
   */
  async recalculateScore(req, res) {
    try {
      const { retailerId } = req.params;

      const scoreData = await creditScoreWorker.recalculateRetailerScore(retailerId);

      return successResponse(res, scoreData, 'Credit score recalculated successfully');
    } catch (error) {
      logger.error('Recalculate score error', {
        retailerId: req.params.retailerId,
        error: error.message,
      });
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Recalculate all credit scores (admin only)
   * POST /api/v1/credit-scoring/recalculate-all
   */
  async recalculateAllScores(req, res) {
    try {
      // Start recalculation in background
      creditScoreWorker.recalculateAllScores().catch(error => {
        logger.error('Background recalculation failed', { error: error.message });
      });

      return successResponse(
        res,
        { message: 'Credit score recalculation started in background' },
        'Recalculation job started'
      );
    } catch (error) {
      logger.error('Recalculate all scores error', {
        error: error.message,
      });
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get worker status (admin only)
   * GET /api/v1/credit-scoring/worker-status
   */
  async getWorkerStatus(req, res) {
    try {
      const status = creditScoreWorker.getStatus();

      return successResponse(res, status, 'Worker status retrieved');
    } catch (error) {
      logger.error('Get worker status error', {
        error: error.message,
      });
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Get credit score distribution (admin only)
   * GET /api/v1/credit-scoring/distribution
   */
  async getScoreDistribution(req, res) {
    try {
      const prisma = require('../config/database');

      const retailers = await prisma.retailer.findMany({
        where: {
          isApproved: true,
          deletedAt: null,
        },
        select: {
          creditScore: true,
        },
      });

      const distribution = {
        excellent: retailers.filter(r => r.creditScore >= 750).length,
        good: retailers.filter(r => r.creditScore >= 650 && r.creditScore < 750).length,
        fair: retailers.filter(r => r.creditScore >= 550 && r.creditScore < 650).length,
        poor: retailers.filter(r => r.creditScore >= 450 && r.creditScore < 550).length,
        veryPoor: retailers.filter(r => r.creditScore < 450).length,
        total: retailers.length,
      };

      const avgScore = retailers.length > 0
        ? Math.round(retailers.reduce((sum, r) => sum + r.creditScore, 0) / retailers.length)
        : 0;

      return successResponse(
        res,
        {
          distribution,
          averageScore: avgScore,
        },
        'Score distribution retrieved'
      );
    } catch (error) {
      logger.error('Get score distribution error', {
        error: error.message,
      });
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new CreditScoringController();
