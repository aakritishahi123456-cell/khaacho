const priceIntelligenceService = require('../services/priceIntelligence.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

class PriceIntelligenceController {
  /**
   * Get price intelligence dashboard
   * GET /api/v1/price-intelligence/dashboard
   */
  async getDashboard(req, res) {
    try {
      const dashboard = await priceIntelligenceService.getPriceIntelligenceDashboard();

      return successResponse(res, dashboard, 'Price intelligence dashboard retrieved successfully');
    } catch (error) {
      logger.error('Error in getDashboard controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to retrieve dashboard', 500);
    }
  }

  /**
   * Get product price history
   * GET /api/v1/price-intelligence/products/:productId/history
   */
  async getProductPriceHistory(req, res) {
    try {
      const { productId } = req.params;
      const { vendorId, limit, startDate, endDate } = req.query;

      const history = await priceIntelligenceService.getProductPriceHistory(productId, {
        vendorId,
        limit: limit ? parseInt(limit) : undefined,
        startDate,
        endDate,
      });

      return successResponse(res, {
        history,
        count: history.length,
      }, 'Price history retrieved successfully');
    } catch (error) {
      logger.error('Error in getProductPriceHistory controller', {
        error: error.message,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to retrieve price history', 500);
    }
  }

  /**
   * Get market analytics for a product
   * GET /api/v1/price-intelligence/products/:productId/analytics
   */
  async getMarketAnalytics(req, res) {
    try {
      const { productId } = req.params;

      const analytics = await priceIntelligenceService.getMarketAnalytics(productId);

      if (!analytics) {
        return errorResponse(res, 'Market analytics not found', 404);
      }

      return successResponse(res, analytics, 'Market analytics retrieved successfully');
    } catch (error) {
      logger.error('Error in getMarketAnalytics controller', {
        error: error.message,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to retrieve market analytics', 500);
    }
  }

  /**
   * Get all market analytics
   * GET /api/v1/price-intelligence/analytics
   */
  async getAllMarketAnalytics(req, res) {
    try {
      const {
        sortBy,
        sortOrder,
        volatilityRating,
        trend,
        limit,
        offset,
      } = req.query;

      const analytics = await priceIntelligenceService.getAllMarketAnalytics({
        sortBy,
        sortOrder,
        volatilityRating,
        trend,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      return successResponse(res, {
        analytics,
        count: analytics.length,
      }, 'Market analytics retrieved successfully');
    } catch (error) {
      logger.error('Error in getAllMarketAnalytics controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to retrieve market analytics', 500);
    }
  }

  /**
   * Get price alerts
   * GET /api/v1/price-intelligence/alerts
   */
  async getPriceAlerts(req, res) {
    try {
      const {
        productId,
        vendorId,
        alertType,
        severity,
        isAcknowledged,
        limit,
        offset,
      } = req.query;

      const alerts = await priceIntelligenceService.getPriceAlerts({
        productId,
        vendorId,
        alertType,
        severity,
        isAcknowledged: isAcknowledged === 'true',
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      return successResponse(res, {
        alerts,
        count: alerts.length,
      }, 'Price alerts retrieved successfully');
    } catch (error) {
      logger.error('Error in getPriceAlerts controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to retrieve price alerts', 500);
    }
  }

  /**
   * Acknowledge price alert
   * POST /api/v1/price-intelligence/alerts/:alertId/acknowledge
   */
  async acknowledgePriceAlert(req, res) {
    try {
      const { alertId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;

      await priceIntelligenceService.acknowledgePriceAlert(alertId, userId, notes);

      return successResponse(res, null, 'Price alert acknowledged successfully');
    } catch (error) {
      logger.error('Error in acknowledgePriceAlert controller', {
        error: error.message,
        alertId: req.params.alertId,
      });
      return errorResponse(res, 'Failed to acknowledge price alert', 500);
    }
  }

  /**
   * Get lowest price vendor for a product
   * GET /api/v1/price-intelligence/products/:productId/lowest-price-vendor
   */
  async getLowestPriceVendor(req, res) {
    try {
      const { productId } = req.params;

      const vendor = await priceIntelligenceService.getLowestPriceVendor(productId);

      if (!vendor) {
        return errorResponse(res, 'No vendors found for this product', 404);
      }

      return successResponse(res, vendor, 'Lowest price vendor retrieved successfully');
    } catch (error) {
      logger.error('Error in getLowestPriceVendor controller', {
        error: error.message,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to retrieve lowest price vendor', 500);
    }
  }

  /**
   * Get price comparison for a product
   * GET /api/v1/price-intelligence/products/:productId/comparison
   */
  async getPriceComparison(req, res) {
    try {
      const { productId } = req.params;

      const comparison = await priceIntelligenceService.getPriceComparison(productId);

      return successResponse(res, {
        comparison,
        count: comparison.length,
      }, 'Price comparison retrieved successfully');
    } catch (error) {
      logger.error('Error in getPriceComparison controller', {
        error: error.message,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to retrieve price comparison', 500);
    }
  }

  /**
   * Get price trends for a product
   * GET /api/v1/price-intelligence/products/:productId/trends
   */
  async getPriceTrends(req, res) {
    try {
      const { productId } = req.params;
      const { days = 30 } = req.query;

      const trends = await priceIntelligenceService.getPriceTrends(productId, parseInt(days));

      return successResponse(res, {
        trends,
        count: trends.length,
        period: `${days} days`,
      }, 'Price trends retrieved successfully');
    } catch (error) {
      logger.error('Error in getPriceTrends controller', {
        error: error.message,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to retrieve price trends', 500);
    }
  }

  /**
   * Get volatile products
   * GET /api/v1/price-intelligence/volatile-products
   */
  async getVolatileProducts(req, res) {
    try {
      const { threshold = 50, limit = 20 } = req.query;

      const products = await priceIntelligenceService.getVolatileProducts(
        parseFloat(threshold),
        parseInt(limit)
      );

      return successResponse(res, {
        products,
        count: products.length,
        threshold: parseFloat(threshold),
      }, 'Volatile products retrieved successfully');
    } catch (error) {
      logger.error('Error in getVolatileProducts controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to retrieve volatile products', 500);
    }
  }

  /**
   * Update market analytics for a product
   * POST /api/v1/price-intelligence/products/:productId/update-analytics
   */
  async updateMarketAnalytics(req, res) {
    try {
      const { productId } = req.params;

      await priceIntelligenceService.updateMarketAnalytics(productId);

      return successResponse(res, null, 'Market analytics updated successfully');
    } catch (error) {
      logger.error('Error in updateMarketAnalytics controller', {
        error: error.message,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to update market analytics', 500);
    }
  }

  /**
   * Update market analytics for all products
   * POST /api/v1/price-intelligence/update-all-analytics
   */
  async updateAllMarketAnalytics(req, res) {
    try {
      const result = await priceIntelligenceService.updateAllMarketAnalytics();

      return successResponse(res, result, 'All market analytics updated successfully');
    } catch (error) {
      logger.error('Error in updateAllMarketAnalytics controller', {
        error: error.message,
      });
      return errorResponse(res, 'Failed to update all market analytics', 500);
    }
  }

  /**
   * Calculate price volatility for a product
   * GET /api/v1/price-intelligence/products/:productId/volatility
   */
  async calculatePriceVolatility(req, res) {
    try {
      const { productId } = req.params;
      const { days = 30 } = req.query;

      const volatilityScore = await priceIntelligenceService.calculatePriceVolatility(
        productId,
        parseInt(days)
      );

      let rating;
      if (volatilityScore >= 75) rating = 'HIGHLY_VOLATILE';
      else if (volatilityScore >= 50) rating = 'VOLATILE';
      else if (volatilityScore >= 25) rating = 'MODERATE';
      else rating = 'STABLE';

      return successResponse(res, {
        volatilityScore: parseFloat(volatilityScore),
        rating,
        period: `${days} days`,
      }, 'Price volatility calculated successfully');
    } catch (error) {
      logger.error('Error in calculatePriceVolatility controller', {
        error: error.message,
        productId: req.params.productId,
      });
      return errorResponse(res, 'Failed to calculate price volatility', 500);
    }
  }
}

module.exports = new PriceIntelligenceController();
