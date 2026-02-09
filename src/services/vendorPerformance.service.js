const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class VendorPerformanceService {
  /**
   * Calculate and update vendor performance metrics
   */
  async calculateVendorPerformance(vendorId) {
    try {
      // Call the database function to update metrics
      await prisma.$executeRawUnsafe(
        `SELECT update_vendor_performance_metrics($1::uuid)`,
        vendorId
      );

      // Fetch the updated performance data
      const performance = await prisma.$queryRawUnsafe(
        `SELECT * FROM vendor_performance WHERE vendor_id = $1::uuid AND calculation_period = 'all_time'`,
        vendorId
      );

      return performance[0] || null;
    } catch (error) {
      logger.error('Error calculating vendor performance', {
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get vendor performance metrics
   */
  async getVendorPerformance(vendorId, period = 'all_time') {
    try {
      const performance = await prisma.$queryRawUnsafe(
        `SELECT * FROM vendor_performance WHERE vendor_id = $1::uuid AND calculation_period = $2`,
        vendorId,
        period
      );

      if (!performance || performance.length === 0) {
        // Calculate if not exists
        await this.calculateVendorPerformance(vendorId);
        return await this.getVendorPerformance(vendorId, period);
      }

      return performance[0];
    } catch (error) {
      logger.error('Error getting vendor performance', {
        vendorId,
        period,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get performance metrics for all vendors
   */
  async getAllVendorsPerformance(options = {}) {
    try {
      const {
        period = 'all_time',
        sortBy = 'reliability_score',
        sortOrder = 'DESC',
        limit = 100,
        offset = 0,
      } = options;

      const validSortFields = [
        'reliability_score',
        'acceptance_rate',
        'completion_rate',
        'avg_fulfillment_time',
        'cancellation_rate',
        'price_competitiveness_index',
      ];

      const sortField = validSortFields.includes(sortBy) ? sortBy : 'reliability_score';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const performances = await prisma.$queryRawUnsafe(
        `SELECT 
          vp.*,
          v.id as vendor_id,
          u.name as vendor_name,
          u.business_name,
          u.city,
          v.rating as vendor_rating
        FROM vendor_performance vp
        JOIN vendors v ON vp.vendor_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE vp.calculation_period = $1
        AND v.deleted_at IS NULL
        AND u.is_active = true
        ORDER BY vp.${sortField} ${order}
        LIMIT $2 OFFSET $3`,
        period,
        limit,
        offset
      );

      return performances;
    } catch (error) {
      logger.error('Error getting all vendors performance', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get vendor performance history (trends)
   */
  async getVendorPerformanceHistory(vendorId, options = {}) {
    try {
      const {
        periodType = 'monthly',
        startDate,
        endDate,
        limit = 12,
      } = options;

      let query = `
        SELECT * FROM vendor_performance_history
        WHERE vendor_id = $1::uuid
        AND period_type = $2
      `;

      const params = [vendorId, periodType];
      let paramIndex = 3;

      if (startDate) {
        query += ` AND period_start >= $${paramIndex}::date`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND period_end <= $${paramIndex}::date`;
        params.push(endDate);
        paramIndex++;
      }

      query += ` ORDER BY period_start DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const history = await prisma.$queryRawUnsafe(query, ...params);

      return history;
    } catch (error) {
      logger.error('Error getting vendor performance history', {
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get vendor performance events
   */
  async getVendorPerformanceEvents(vendorId, options = {}) {
    try {
      const {
        eventType,
        limit = 50,
        offset = 0,
      } = options;

      let query = `
        SELECT 
          vpe.*,
          o.order_number
        FROM vendor_performance_events vpe
        LEFT JOIN orders o ON vpe.order_id = o.id
        WHERE vpe.vendor_id = $1::uuid
      `;

      const params = [vendorId];
      let paramIndex = 2;

      if (eventType) {
        query += ` AND vpe.event_type = $${paramIndex}`;
        params.push(eventType);
        paramIndex++;
      }

      query += ` ORDER BY vpe.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const events = await prisma.$queryRawUnsafe(query, ...params);

      return events;
    } catch (error) {
      logger.error('Error getting vendor performance events', {
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Update vendor price comparison
   */
  async updateVendorPriceComparison(productId, vendorId, vendorPrice) {
    try {
      // Calculate market average price for this product
      const marketAvg = await prisma.$queryRawUnsafe(
        `SELECT AVG(vendor_price) as avg_price
         FROM vendor_price_comparison
         WHERE product_id = $1::uuid`,
        productId
      );

      const marketAvgPrice = marketAvg[0]?.avg_price || vendorPrice;
      const priceDeviation = ((vendorPrice - marketAvgPrice) / marketAvgPrice) * 100;
      const isCompetitive = Math.abs(priceDeviation) <= 10;

      // Upsert price comparison
      await prisma.$executeRawUnsafe(
        `INSERT INTO vendor_price_comparison (
          product_id, vendor_id, vendor_price, market_avg_price, 
          price_deviation, is_competitive, last_updated
        ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (product_id, vendor_id)
        DO UPDATE SET
          vendor_price = EXCLUDED.vendor_price,
          market_avg_price = EXCLUDED.market_avg_price,
          price_deviation = EXCLUDED.price_deviation,
          is_competitive = EXCLUDED.is_competitive,
          last_updated = EXCLUDED.last_updated`,
        productId,
        vendorId,
        vendorPrice,
        marketAvgPrice,
        priceDeviation,
        isCompetitive
      );

      return {
        productId,
        vendorId,
        vendorPrice,
        marketAvgPrice,
        priceDeviation,
        isCompetitive,
      };
    } catch (error) {
      logger.error('Error updating vendor price comparison', {
        productId,
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get vendor price competitiveness
   */
  async getVendorPriceCompetitiveness(vendorId) {
    try {
      const prices = await prisma.$queryRawUnsafe(
        `SELECT 
          vpc.*,
          p.name as product_name,
          p.product_code
        FROM vendor_price_comparison vpc
        JOIN products p ON vpc.product_id = p.id
        WHERE vpc.vendor_id = $1::uuid
        ORDER BY vpc.price_deviation ASC`,
        vendorId
      );

      return prices;
    } catch (error) {
      logger.error('Error getting vendor price competitiveness', {
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get vendor performance dashboard data
   */
  async getVendorPerformanceDashboard(vendorId) {
    try {
      // Get current performance
      const performance = await this.getVendorPerformance(vendorId);

      // Get recent history (last 6 months)
      const history = await this.getVendorPerformanceHistory(vendorId, {
        periodType: 'monthly',
        limit: 6,
      });

      // Get recent events
      const events = await this.getVendorPerformanceEvents(vendorId, {
        limit: 10,
      });

      // Get price competitiveness
      const priceData = await this.getVendorPriceCompetitiveness(vendorId);

      // Get vendor details
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
          user: {
            select: {
              name: true,
              businessName: true,
              city: true,
              phoneNumber: true,
              email: true,
            },
          },
        },
      });

      // Calculate performance grade
      const grade = this.calculatePerformanceGrade(performance?.reliability_score || 0);

      // Get pending orders count
      const pendingOrders = await prisma.vendorOrderAcceptance.count({
        where: {
          vendorId,
          status: 'pending',
        },
      });

      return {
        vendor: {
          id: vendor.id,
          name: vendor.user.name,
          businessName: vendor.user.businessName,
          city: vendor.user.city,
          phoneNumber: vendor.user.phoneNumber,
          email: vendor.user.email,
          rating: vendor.rating,
        },
        performance: {
          ...performance,
          grade,
          pendingOrders,
        },
        history: history.reverse(), // Oldest to newest
        recentEvents: events,
        priceCompetitiveness: {
          products: priceData,
          averageDeviation: priceData.length > 0
            ? priceData.reduce((sum, p) => sum + parseFloat(p.price_deviation), 0) / priceData.length
            : 0,
          competitiveCount: priceData.filter(p => p.is_competitive).length,
          totalProducts: priceData.length,
        },
      };
    } catch (error) {
      logger.error('Error getting vendor performance dashboard', {
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get performance comparison for multiple vendors
   */
  async compareVendors(vendorIds) {
    try {
      const performances = await Promise.all(
        vendorIds.map(id => this.getVendorPerformance(id))
      );

      const vendors = await prisma.vendor.findMany({
        where: {
          id: { in: vendorIds },
        },
        include: {
          user: {
            select: {
              name: true,
              businessName: true,
            },
          },
        },
      });

      return vendorIds.map((id, index) => ({
        vendorId: id,
        vendorName: vendors[index]?.user.name,
        businessName: vendors[index]?.user.businessName,
        performance: performances[index],
        grade: this.calculatePerformanceGrade(performances[index]?.reliability_score || 0),
      }));
    } catch (error) {
      logger.error('Error comparing vendors', {
        vendorIds,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Calculate performance grade based on reliability score
   */
  calculatePerformanceGrade(score) {
    if (score >= 90) return { grade: 'A+', label: 'Excellent', color: '#10b981' };
    if (score >= 80) return { grade: 'A', label: 'Very Good', color: '#22c55e' };
    if (score >= 70) return { grade: 'B', label: 'Good', color: '#84cc16' };
    if (score >= 60) return { grade: 'C', label: 'Fair', color: '#eab308' };
    if (score >= 50) return { grade: 'D', label: 'Poor', color: '#f97316' };
    return { grade: 'F', label: 'Very Poor', color: '#ef4444' };
  }

  /**
   * Get top performing vendors
   */
  async getTopPerformers(limit = 10) {
    try {
      return await this.getAllVendorsPerformance({
        sortBy: 'reliability_score',
        sortOrder: 'DESC',
        limit,
      });
    } catch (error) {
      logger.error('Error getting top performers', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get vendors needing attention (low performance)
   */
  async getVendorsNeedingAttention(threshold = 60) {
    try {
      const vendors = await prisma.$queryRawUnsafe(
        `SELECT 
          vp.*,
          v.id as vendor_id,
          u.name as vendor_name,
          u.business_name,
          u.city
        FROM vendor_performance vp
        JOIN vendors v ON vp.vendor_id = v.id
        JOIN users u ON v.user_id = u.id
        WHERE vp.calculation_period = 'all_time'
        AND vp.reliability_score < $1
        AND v.deleted_at IS NULL
        AND u.is_active = true
        ORDER BY vp.reliability_score ASC`,
        threshold
      );

      return vendors;
    } catch (error) {
      logger.error('Error getting vendors needing attention', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Recalculate all vendor performances (for batch processing)
   */
  async recalculateAllVendors() {
    try {
      const vendors = await prisma.vendor.findMany({
        where: {
          deletedAt: null,
          isApproved: true,
        },
        select: { id: true },
      });

      logger.info(`Recalculating performance for ${vendors.length} vendors`);

      const results = [];
      for (const vendor of vendors) {
        try {
          const performance = await this.calculateVendorPerformance(vendor.id);
          results.push({
            vendorId: vendor.id,
            success: true,
            performance,
          });
        } catch (error) {
          logger.error(`Failed to calculate performance for vendor ${vendor.id}`, {
            error: error.message,
          });
          results.push({
            vendorId: vendor.id,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      logger.info(`Performance recalculation complete: ${successCount}/${vendors.length} successful`);

      return {
        total: vendors.length,
        successful: successCount,
        failed: vendors.length - successCount,
        results,
      };
    } catch (error) {
      logger.error('Error recalculating all vendors', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Log performance event manually
   */
  async logPerformanceEvent(vendorId, orderId, eventType, eventData = {}) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO vendor_performance_events (
          vendor_id, order_id, event_type, event_data,
          affects_acceptance, affects_completion, 
          affects_fulfillment_time, affects_cancellation
        ) VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7, $8)`,
        vendorId,
        orderId,
        eventType,
        JSON.stringify(eventData),
        eventData.affectsAcceptance || false,
        eventData.affectsCompletion || false,
        eventData.affectsFulfillmentTime || false,
        eventData.affectsCancellation || false
      );

      logger.info('Performance event logged', {
        vendorId,
        orderId,
        eventType,
      });
    } catch (error) {
      logger.error('Error logging performance event', {
        vendorId,
        orderId,
        eventType,
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new VendorPerformanceService();
