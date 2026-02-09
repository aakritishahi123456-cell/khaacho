const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class PriceIntelligenceService {
  /**
   * Get price history for a product
   */
  async getProductPriceHistory(productId, options = {}) {
    try {
      const {
        vendorId,
        limit = 100,
        startDate,
        endDate,
      } = options;

      let query = `
        SELECT 
          pph.*,
          v.vendor_code,
          u.business_name as vendor_name,
          p.name as product_name,
          p.product_code
        FROM product_price_history pph
        JOIN vendors v ON pph.vendor_id = v.id
        JOIN users u ON v.user_id = u.id
        JOIN products p ON pph.product_id = p.id
        WHERE pph.product_id = $1::uuid
      `;

      const params = [productId];
      let paramIndex = 2;

      if (vendorId) {
        query += ` AND pph.vendor_id = $${paramIndex}::uuid`;
        params.push(vendorId);
        paramIndex++;
      }

      if (startDate) {
        query += ` AND pph.created_at >= $${paramIndex}::timestamp`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND pph.created_at <= $${paramIndex}::timestamp`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY pph.created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const history = await prisma.$queryRawUnsafe(query, ...params);

      return history;
    } catch (error) {
      logger.error('Error getting product price history', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get market price analytics for a product
   */
  async getMarketAnalytics(productId) {
    try {
      const analytics = await prisma.$queryRawUnsafe(
        `SELECT 
          mpa.*,
          p.name as product_name,
          p.product_code,
          v.vendor_code as lowest_price_vendor_code,
          u.business_name as lowest_price_vendor_name
        FROM market_price_analytics mpa
        JOIN products p ON mpa.product_id = p.id
        LEFT JOIN vendors v ON mpa.lowest_price_vendor_id = v.id
        LEFT JOIN users u ON v.user_id = u.id
        WHERE mpa.product_id = $1::uuid`,
        productId
      );

      if (!analytics || analytics.length === 0) {
        // Calculate if not exists
        await this.updateMarketAnalytics(productId);
        return await this.getMarketAnalytics(productId);
      }

      return analytics[0];
    } catch (error) {
      logger.error('Error getting market analytics', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get market analytics for all products
   */
  async getAllMarketAnalytics(options = {}) {
    try {
      const {
        sortBy = 'price_volatility_score',
        sortOrder = 'DESC',
        volatilityRating,
        trend,
        limit = 100,
        offset = 0,
      } = options;

      const validSortFields = [
        'price_volatility_score',
        'current_avg_price',
        'price_change_30d_percent',
        'price_range_percent',
        'trend_strength',
      ];

      const sortField = validSortFields.includes(sortBy) ? sortBy : 'price_volatility_score';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      let query = `
        SELECT 
          mpa.*,
          p.name as product_name,
          p.product_code,
          p.category,
          v.vendor_code as lowest_price_vendor_code,
          u.business_name as lowest_price_vendor_name
        FROM market_price_analytics mpa
        JOIN products p ON mpa.product_id = p.id
        LEFT JOIN vendors v ON mpa.lowest_price_vendor_id = v.id
        LEFT JOIN users u ON v.user_id = u.id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      if (volatilityRating) {
        query += ` AND mpa.price_stability_rating = $${paramIndex}`;
        params.push(volatilityRating);
        paramIndex++;
      }

      if (trend) {
        query += ` AND mpa.price_trend = $${paramIndex}`;
        params.push(trend);
        paramIndex++;
      }

      query += ` ORDER BY mpa.${sortField} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const analytics = await prisma.$queryRawUnsafe(query, ...params);

      return analytics;
    } catch (error) {
      logger.error('Error getting all market analytics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get price alerts
   */
  async getPriceAlerts(options = {}) {
    try {
      const {
        productId,
        vendorId,
        alertType,
        severity,
        isAcknowledged = false,
        limit = 50,
        offset = 0,
      } = options;

      let query = `
        SELECT 
          pa.*,
          p.name as product_name,
          p.product_code,
          v.vendor_code,
          u.business_name as vendor_name
        FROM price_alerts pa
        JOIN products p ON pa.product_id = p.id
        LEFT JOIN vendors v ON pa.vendor_id = v.id
        LEFT JOIN users u ON v.user_id = u.id
        WHERE pa.is_acknowledged = $1
      `;

      const params = [isAcknowledged];
      let paramIndex = 2;

      if (productId) {
        query += ` AND pa.product_id = $${paramIndex}::uuid`;
        params.push(productId);
        paramIndex++;
      }

      if (vendorId) {
        query += ` AND pa.vendor_id = $${paramIndex}::uuid`;
        params.push(vendorId);
        paramIndex++;
      }

      if (alertType) {
        query += ` AND pa.alert_type = $${paramIndex}`;
        params.push(alertType);
        paramIndex++;
      }

      if (severity) {
        query += ` AND pa.severity = $${paramIndex}`;
        params.push(severity);
        paramIndex++;
      }

      query += ` ORDER BY pa.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const alerts = await prisma.$queryRawUnsafe(query, ...params);

      return alerts;
    } catch (error) {
      logger.error('Error getting price alerts', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Acknowledge price alert
   */
  async acknowledgePriceAlert(alertId, userId, notes = null) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE price_alerts
         SET is_acknowledged = TRUE,
             acknowledged_by = $1::uuid,
             acknowledged_at = CURRENT_TIMESTAMP,
             acknowledgement_notes = $2
         WHERE id = $3::uuid`,
        userId,
        notes,
        alertId
      );

      logger.info('Price alert acknowledged', { alertId, userId });

      return { success: true };
    } catch (error) {
      logger.error('Error acknowledging price alert', {
        alertId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get lowest price vendor for a product
   */
  async getLowestPriceVendor(productId) {
    try {
      const result = await prisma.$queryRawUnsafe(
        `SELECT 
          vp.vendor_id,
          vp.vendor_price,
          v.vendor_code,
          u.business_name as vendor_name,
          u.city,
          mpa.current_avg_price as market_avg,
          ((vp.vendor_price - mpa.current_avg_price) / mpa.current_avg_price * 100) as deviation_from_avg
        FROM vendor_products vp
        JOIN vendors v ON vp.vendor_id = v.id
        JOIN users u ON v.user_id = u.id
        LEFT JOIN market_price_analytics mpa ON vp.product_id = mpa.product_id
        WHERE vp.product_id = $1::uuid
        AND vp.is_available = TRUE
        AND vp.deleted_at IS NULL
        ORDER BY vp.vendor_price ASC
        LIMIT 1`,
        productId
      );

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting lowest price vendor', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get price comparison for a product across all vendors
   */
  async getPriceComparison(productId) {
    try {
      const comparison = await prisma.$queryRawUnsafe(
        `SELECT 
          vp.vendor_id,
          vp.vendor_price,
          v.vendor_code,
          u.business_name as vendor_name,
          u.city,
          vp.stock,
          vp.is_available,
          mpa.current_avg_price as market_avg,
          mpa.current_min_price as market_min,
          mpa.current_max_price as market_max,
          ((vp.vendor_price - mpa.current_avg_price) / mpa.current_avg_price * 100) as deviation_from_avg,
          CASE 
            WHEN vp.vendor_price = mpa.current_min_price THEN TRUE
            ELSE FALSE
          END as is_lowest_price,
          CASE 
            WHEN vp.vendor_price <= mpa.current_avg_price * 1.05 THEN 'EXCELLENT'
            WHEN vp.vendor_price <= mpa.current_avg_price * 1.10 THEN 'GOOD'
            WHEN vp.vendor_price <= mpa.current_avg_price * 1.15 THEN 'FAIR'
            ELSE 'EXPENSIVE'
          END as price_rating
        FROM vendor_products vp
        JOIN vendors v ON vp.vendor_id = v.id
        JOIN users u ON v.user_id = u.id
        LEFT JOIN market_price_analytics mpa ON vp.product_id = mpa.product_id
        WHERE vp.product_id = $1::uuid
        AND vp.deleted_at IS NULL
        ORDER BY vp.vendor_price ASC`,
        productId
      );

      return comparison;
    } catch (error) {
      logger.error('Error getting price comparison', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get price trends for a product
   */
  async getPriceTrends(productId, days = 30) {
    try {
      const trends = await prisma.$queryRawUnsafe(
        `SELECT 
          DATE(created_at) as date,
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          COUNT(DISTINCT vendor_id) as vendors_count,
          AVG(market_avg_price) as market_avg
        FROM product_price_history
        WHERE product_id = $1::uuid
        AND created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY date ASC`,
        productId,
        days
      );

      return trends;
    } catch (error) {
      logger.error('Error getting price trends', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get volatile products (high price volatility)
   */
  async getVolatileProducts(threshold = 50, limit = 20) {
    try {
      const products = await prisma.$queryRawUnsafe(
        `SELECT 
          mpa.*,
          p.name as product_name,
          p.product_code,
          p.category
        FROM market_price_analytics mpa
        JOIN products p ON mpa.product_id = p.id
        WHERE mpa.price_volatility_score >= $1
        ORDER BY mpa.price_volatility_score DESC
        LIMIT $2`,
        threshold,
        limit
      );

      return products;
    } catch (error) {
      logger.error('Error getting volatile products', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update market analytics for a product
   */
  async updateMarketAnalytics(productId) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT update_market_price_analytics($1::uuid)`,
        productId
      );

      logger.info('Market analytics updated', { productId });

      return { success: true };
    } catch (error) {
      logger.error('Error updating market analytics', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update market analytics for all products
   */
  async updateAllMarketAnalytics() {
    try {
      const products = await prisma.product.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });

      logger.info(`Updating market analytics for ${products.length} products`);

      const results = [];
      for (const product of products) {
        try {
          await this.updateMarketAnalytics(product.id);
          results.push({ productId: product.id, success: true });
        } catch (error) {
          logger.error(`Failed to update analytics for product ${product.id}`, {
            error: error.message,
          });
          results.push({ productId: product.id, success: false, error: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info(`Market analytics update complete: ${successCount}/${products.length} successful`);

      return {
        total: products.length,
        successful: successCount,
        failed: products.length - successCount,
        results,
      };
    } catch (error) {
      logger.error('Error updating all market analytics', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get price intelligence dashboard data
   */
  async getPriceIntelligenceDashboard() {
    try {
      // Get summary statistics
      const summary = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(DISTINCT product_id) as total_products,
          AVG(price_volatility_score) as avg_volatility,
          COUNT(*) FILTER (WHERE price_stability_rating = 'HIGHLY_VOLATILE') as highly_volatile_count,
          COUNT(*) FILTER (WHERE price_stability_rating = 'VOLATILE') as volatile_count,
          COUNT(*) FILTER (WHERE price_trend = 'INCREASING') as increasing_trend_count,
          COUNT(*) FILTER (WHERE price_trend = 'DECREASING') as decreasing_trend_count,
          AVG(price_change_30d_percent) as avg_price_change_30d
        FROM market_price_analytics
      `);

      // Get unacknowledged alerts count
      const alertsCount = await prisma.$queryRawUnsafe(`
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_alerts,
          COUNT(*) FILTER (WHERE severity = 'HIGH') as high_alerts,
          COUNT(*) FILTER (WHERE alert_type = 'abnormal_increase') as abnormal_increase_count,
          COUNT(*) FILTER (WHERE alert_type = 'abnormal_decrease') as abnormal_decrease_count
        FROM price_alerts
        WHERE is_acknowledged = FALSE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `);

      // Get most volatile products
      const volatileProducts = await this.getVolatileProducts(50, 10);

      // Get recent price alerts
      const recentAlerts = await this.getPriceAlerts({ limit: 10 });

      // Get products with biggest price changes
      const biggestChanges = await prisma.$queryRawUnsafe(`
        SELECT 
          mpa.product_id,
          p.name as product_name,
          p.product_code,
          mpa.current_avg_price,
          mpa.avg_price_30d_ago,
          mpa.price_change_30d,
          mpa.price_change_30d_percent,
          mpa.price_trend
        FROM market_price_analytics mpa
        JOIN products p ON mpa.product_id = p.id
        WHERE mpa.price_change_30d_percent IS NOT NULL
        ORDER BY ABS(mpa.price_change_30d_percent) DESC
        LIMIT 10
      `);

      return {
        summary: summary[0],
        alerts: {
          ...alertsCount[0],
          recent: recentAlerts,
        },
        volatileProducts,
        biggestChanges,
      };
    } catch (error) {
      logger.error('Error getting price intelligence dashboard', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get best price vendor for order routing
   */
  async getBestPriceVendorForRouting(productId, eligibleVendorIds) {
    try {
      if (!eligibleVendorIds || eligibleVendorIds.length === 0) {
        return null;
      }

      const placeholders = eligibleVendorIds.map((_, i) => `$${i + 2}::uuid`).join(',');

      const result = await prisma.$queryRawUnsafe(
        `SELECT 
          vp.vendor_id,
          vp.vendor_price,
          v.vendor_code,
          u.business_name as vendor_name,
          mpa.current_avg_price as market_avg,
          ((vp.vendor_price - mpa.current_avg_price) / mpa.current_avg_price * 100) as deviation_from_avg,
          CASE 
            WHEN vp.vendor_price <= mpa.current_avg_price * 0.90 THEN 100
            WHEN vp.vendor_price <= mpa.current_avg_price * 0.95 THEN 90
            WHEN vp.vendor_price <= mpa.current_avg_price * 1.00 THEN 80
            WHEN vp.vendor_price <= mpa.current_avg_price * 1.05 THEN 70
            WHEN vp.vendor_price <= mpa.current_avg_price * 1.10 THEN 60
            ELSE 50
          END as price_score
        FROM vendor_products vp
        JOIN vendors v ON vp.vendor_id = v.id
        JOIN users u ON v.user_id = u.id
        LEFT JOIN market_price_analytics mpa ON vp.product_id = mpa.product_id
        WHERE vp.product_id = $1::uuid
        AND vp.vendor_id IN (${placeholders})
        AND vp.is_available = TRUE
        AND vp.deleted_at IS NULL
        ORDER BY vp.vendor_price ASC
        LIMIT 1`,
        productId,
        ...eligibleVendorIds
      );

      return result[0] || null;
    } catch (error) {
      logger.error('Error getting best price vendor for routing', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate price volatility for a product
   */
  async calculatePriceVolatility(productId, days = 30) {
    try {
      const result = await prisma.$queryRawUnsafe(
        `SELECT calculate_price_volatility($1::uuid, $2) as volatility_score`,
        productId,
        days
      );

      return result[0]?.volatility_score || 0;
    } catch (error) {
      logger.error('Error calculating price volatility', {
        productId,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new PriceIntelligenceService();
