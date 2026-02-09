const { query, param } = require('express-validator');
const AnalyticsService = require('../services/analytics.service');
const ApiResponse = require('../utils/response');

class AnalyticsController {
  static orderTrendsValidation = [
    query('startDate').isISO8601().withMessage('Invalid start date'),
    query('endDate').isISO8601().withMessage('Invalid end date'),
    query('groupBy').optional().isIn(['hour', 'day', 'week', 'month']).withMessage('Invalid groupBy value'),
  ];

  async getOrderTrends(req, res, next) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      const trends = await AnalyticsService.getOrderTrends(
        new Date(startDate),
        new Date(endDate),
        groupBy
      );
      return ApiResponse.success(res, trends, 'Order trends retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getProductPerformance(req, res, next) {
    try {
      const { limit = 20 } = req.query;
      const performance = await AnalyticsService.getProductPerformance(parseInt(limit));
      return ApiResponse.success(res, performance, 'Product performance retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getRetailerAnalytics(req, res, next) {
    try {
      const { id } = req.params;
      const analytics = await AnalyticsService.getRetailerAnalytics(id);
      return ApiResponse.success(res, analytics, 'Retailer analytics retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getVendorAnalytics(req, res, next) {
    try {
      const { id } = req.params;
      const analytics = await AnalyticsService.getVendorAnalytics(id);
      return ApiResponse.success(res, analytics, 'Vendor analytics retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalyticsController();
