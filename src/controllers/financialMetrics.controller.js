const { param, query } = require('express-validator');
const FinancialMetricsService = require('../services/financialMetrics.service');
const ApiResponse = require('../utils/response');

class FinancialMetricsController {
  async getRetailerMetrics(req, res, next) {
    try {
      const { id } = req.params;
      const metrics = await FinancialMetricsService.getRetailerMetrics(id);
      return ApiResponse.success(res, metrics, 'Financial metrics retrieved');
    } catch (error) {
      next(error);
    }
  }

  async recalculateMetrics(req, res, next) {
    try {
      const { id } = req.params;
      const metrics = await FinancialMetricsService.calculateMetrics(id);
      return ApiResponse.success(res, metrics, 'Metrics recalculated successfully');
    } catch (error) {
      next(error);
    }
  }

  async getHighCreditUtilization(req, res, next) {
    try {
      const { threshold = 80, limit = 50 } = req.query;
      const retailers = await FinancialMetricsService.getHighCreditUtilizationRetailers(
        parseFloat(threshold),
        parseInt(limit)
      );
      return ApiResponse.success(res, retailers, 'High credit utilization retailers retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getPoorPaymentBehavior(req, res, next) {
    try {
      const { threshold = 50, limit = 50 } = req.query;
      const retailers = await FinancialMetricsService.getPoorPaymentBehaviorRetailers(
        parseFloat(threshold),
        parseInt(limit)
      );
      return ApiResponse.success(res, retailers, 'Poor payment behavior retailers retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getTopByFrequency(req, res, next) {
    try {
      const { limit = 50 } = req.query;
      const retailers = await FinancialMetricsService.getTopRetailersByFrequency(parseInt(limit));
      return ApiResponse.success(res, retailers, 'Top retailers by frequency retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getRiskRetailers(req, res, next) {
    try {
      const { limit = 50 } = req.query;
      const retailers = await FinancialMetricsService.getRiskRetailers(parseInt(limit));
      return ApiResponse.success(res, retailers, 'Risk retailers retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getMetricsSummary(req, res, next) {
    try {
      const summary = await FinancialMetricsService.getMetricsSummary();
      return ApiResponse.success(res, summary, 'Metrics summary retrieved');
    } catch (error) {
      next(error);
    }
  }

  async recalculateAll(req, res, next) {
    try {
      const result = await FinancialMetricsService.recalculateAllMetrics();
      return ApiResponse.success(res, result, 'Batch recalculation completed');
    } catch (error) {
      next(error);
    }
  }

  async verifyAccuracy(req, res, next) {
    try {
      const { id } = req.params;
      const verification = await FinancialMetricsService.verifyMetricsAccuracy(id);
      return ApiResponse.success(res, verification, 'Metrics accuracy verified');
    } catch (error) {
      next(error);
    }
  }

  async exportMetrics(req, res, next) {
    try {
      const filters = {
        minCreditUtilization: req.query.minCreditUtilization,
        maxOnTimeRatio: req.query.maxOnTimeRatio,
      };
      const metrics = await FinancialMetricsService.exportMetrics(filters);
      return ApiResponse.success(res, metrics, 'Metrics exported');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FinancialMetricsController();
