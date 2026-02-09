const vendorPerformanceService = require('../services/vendorPerformance.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

class VendorPerformanceController {
  /**
   * Get vendor performance metrics
   * GET /api/v1/vendor-performance/:vendorId
   */
  async getVendorPerformance(req, res) {
    try {
      const { vendorId } = req.params;
      const { period = 'all_time' } = req.query;

      const performance = await vendorPerformanceService.getVendorPerformance(vendorId, period);

      if (!performance) {
        return errorResponse(res, 'Vendor performance data not found', 404);
      }

      return successResponse(res, performance, 'Vendor performance retrieved successfully');
    } catch (error) {
      logger.error('Error in getVendorPerformance controller', {
        error: error.message,
        vendorId: req.params.vendorId,
      });
      return errorResponse(res, 'Failed to retrieve vendor performance', 500);
    }
  }

  /**
   * Get all vendors performance (admin dashboard)
   * GET /api/v1/vendor-performance
   */
  async getAllVendorsPerformance(req, res) {
    try {
      const {
        period = 'all_time',
        sortBy = 'reliability_score',
        sortOrder = 'DESC',
        limit = 100,
        offset = 0,
      } = req.query;

      const performances = await vendorPerformanceService.getAllVendorsPerformance({
        period,
        sortBy,
        sortOrder,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return successResponse(res, {
        performances,
        count: performances.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      }, 'Vendors performance retrieved successfully');
    } catch (error) {
      logger.error('Error in getAllVendorsPerformance controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to retrieve vendors performance', 500);
    }
  }

  /**
   * Get vendor performance dashboard
   * GET /api/v1/vendor-performance/:vendorId/dashboard
   */
  async getVendorDashboard(req, res) {
    try {
      const { vendorId } = req.params;

      const dashboard = await vendorPerformanceService.getVendorPerformanceDashboard(vendorId);

      return successResponse(res, dashboard, 'Vendor dashboard retrieved successfully');
    } catch (error) {
      logger.error('Error in getVendorDashboard controller', {
        error: error.message,
        vendorId: req.params.vendorId,
      });
      return errorResponse(res, 'Failed to retrieve vendor dashboard', 500);
    }
  }

  /**
   * Get vendor performance history
   * GET /api/v1/vendor-performance/:vendorId/history
   */
  async getVendorHistory(req, res) {
    try {
      const { vendorId } = req.params;
      const {
        periodType = 'monthly',
        startDate,
        endDate,
        limit = 12,
      } = req.query;

      const history = await vendorPerformanceService.getVendorPerformanceHistory(vendorId, {
        periodType,
        startDate,
        endDate,
        limit: parseInt(limit),
      });

      return successResponse(res, {
        history,
        count: history.length,
      }, 'Vendor performance history retrieved successfully');
    } catch (error) {
      logger.error('Error in getVendorHistory controller', {
        error: error.message,
        vendorId: req.params.vendorId,
      });
      return errorResponse(res, 'Failed to retrieve vendor history', 500);
    }
  }

  /**
   * Get vendor performance events
   * GET /api/v1/vendor-performance/:vendorId/events
   */
  async getVendorEvents(req, res) {
    try {
      const { vendorId } = req.params;
      const {
        eventType,
        limit = 50,
        offset = 0,
      } = req.query;

      const events = await vendorPerformanceService.getVendorPerformanceEvents(vendorId, {
        eventType,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return successResponse(res, {
        events,
        count: events.length,
      }, 'Vendor performance events retrieved successfully');
    } catch (error) {
      logger.error('Error in getVendorEvents controller', {
        error: error.message,
        vendorId: req.params.vendorId,
      });
      return errorResponse(res, 'Failed to retrieve vendor events', 500);
    }
  }

  /**
   * Get vendor price competitiveness
   * GET /api/v1/vendor-performance/:vendorId/pricing
   */
  async getVendorPricing(req, res) {
    try {
      const { vendorId } = req.params;

      const pricing = await vendorPerformanceService.getVendorPriceCompetitiveness(vendorId);

      return successResponse(res, {
        pricing,
        count: pricing.length,
      }, 'Vendor pricing data retrieved successfully');
    } catch (error) {
      logger.error('Error in getVendorPricing controller', {
        error: error.message,
        vendorId: req.params.vendorId,
      });
      return errorResponse(res, 'Failed to retrieve vendor pricing', 500);
    }
  }

  /**
   * Compare multiple vendors
   * POST /api/v1/vendor-performance/compare
   */
  async compareVendors(req, res) {
    try {
      const { vendorIds } = req.body;

      if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
        return errorResponse(res, 'vendorIds array is required', 400);
      }

      if (vendorIds.length > 10) {
        return errorResponse(res, 'Maximum 10 vendors can be compared at once', 400);
      }

      const comparison = await vendorPerformanceService.compareVendors(vendorIds);

      return successResponse(res, {
        comparison,
        count: comparison.length,
      }, 'Vendor comparison completed successfully');
    } catch (error) {
      logger.error('Error in compareVendors controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to compare vendors', 500);
    }
  }

  /**
   * Get top performing vendors
   * GET /api/v1/vendor-performance/top-performers
   */
  async getTopPerformers(req, res) {
    try {
      const { limit = 10 } = req.query;

      const topPerformers = await vendorPerformanceService.getTopPerformers(parseInt(limit));

      return successResponse(res, {
        topPerformers,
        count: topPerformers.length,
      }, 'Top performers retrieved successfully');
    } catch (error) {
      logger.error('Error in getTopPerformers controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to retrieve top performers', 500);
    }
  }

  /**
   * Get vendors needing attention
   * GET /api/v1/vendor-performance/needs-attention
   */
  async getVendorsNeedingAttention(req, res) {
    try {
      const { threshold = 60 } = req.query;

      const vendors = await vendorPerformanceService.getVendorsNeedingAttention(parseFloat(threshold));

      return successResponse(res, {
        vendors,
        count: vendors.length,
        threshold: parseFloat(threshold),
      }, 'Vendors needing attention retrieved successfully');
    } catch (error) {
      logger.error('Error in getVendorsNeedingAttention controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to retrieve vendors needing attention', 500);
    }
  }

  /**
   * Recalculate vendor performance
   * POST /api/v1/vendor-performance/:vendorId/recalculate
   */
  async recalculateVendorPerformance(req, res) {
    try {
      const { vendorId } = req.params;

      const performance = await vendorPerformanceService.calculateVendorPerformance(vendorId);

      return successResponse(res, performance, 'Vendor performance recalculated successfully');
    } catch (error) {
      logger.error('Error in recalculateVendorPerformance controller', {
        error: error.message,
        vendorId: req.params.vendorId,
      });
      return errorResponse(res, 'Failed to recalculate vendor performance', 500);
    }
  }

  /**
   * Recalculate all vendors performance (admin only)
   * POST /api/v1/vendor-performance/recalculate-all
   */
  async recalculateAllVendors(req, res) {
    try {
      // This is a long-running operation, so we'll start it and return immediately
      const result = await vendorPerformanceService.recalculateAllVendors();

      return successResponse(res, result, 'All vendors performance recalculated successfully');
    } catch (error) {
      logger.error('Error in recalculateAllVendors controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to recalculate all vendors performance', 500);
    }
  }

  /**
   * Update vendor price comparison
   * POST /api/v1/vendor-performance/:vendorId/pricing/:productId
   */
  async updateVendorPricing(req, res) {
    try {
      const { vendorId, productId } = req.params;
      const { vendorPrice } = req.body;

      if (!vendorPrice || vendorPrice <= 0) {
        return errorResponse(res, 'Valid vendorPrice is required', 400);
      }

      const result = await vendorPerformanceService.updateVendorPriceComparison(
        productId,
        vendorId,
        parseFloat(vendorPrice)
      );

      return successResponse(res, result, 'Vendor pricing updated successfully');
    } catch (error) {
      logger.error('Error in updateVendorPricing controller', {
        error: error.message,
        vendorId: req.params.vendorId,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to update vendor pricing', 500);
    }
  }
}

module.exports = new VendorPerformanceController();
