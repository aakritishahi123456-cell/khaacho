const prisma = require('../config/database');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

class FinancialMetricsService {
  /**
   * Get financial metrics for a retailer
   * Metrics are automatically calculated, this just retrieves them
   */
  async getRetailerMetrics(retailerId) {
    const metrics = await prisma.$queryRaw`
      SELECT * FROM retailer_financial_metrics
      WHERE retailer_id = ${retailerId}::uuid
    `;

    if (!metrics || metrics.length === 0) {
      // If metrics don't exist, calculate them
      await this.calculateMetrics(retailerId);
      return await this.getRetailerMetrics(retailerId);
    }

    return metrics[0];
  }

  /**
   * Manually trigger metrics calculation for a retailer
   * This is called automatically by database triggers, but can be called manually if needed
   */
  async calculateMetrics(retailerId) {
    try {
      await prisma.$executeRaw`
        SELECT calculate_retailer_financial_metrics(${retailerId}::uuid)
      `;

      logger.info('Financial metrics calculated', { retailerId });
      return await this.getRetailerMetrics(retailerId);
    } catch (error) {
      logger.error('Failed to calculate financial metrics', {
        retailerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get metrics for multiple retailers
   */
  async getMultipleRetailerMetrics(retailerIds) {
    const metrics = await prisma.$queryRaw`
      SELECT * FROM retailer_financial_metrics
      WHERE retailer_id = ANY(${retailerIds}::uuid[])
    `;

    return metrics;
  }

  /**
   * Get retailers with high credit utilization
   */
  async getHighCreditUtilizationRetailers(threshold = 80, limit = 50) {
    const retailers = await prisma.$queryRaw`
      SELECT 
        rfm.*,
        r.shop_name,
        r.retailer_code,
        u.name,
        u.phone_number
      FROM retailer_financial_metrics rfm
      JOIN retailers r ON rfm.retailer_id = r.id
      JOIN users u ON r.user_id = u.id
      WHERE rfm.credit_utilization_percentage >= ${threshold}
      AND r.deleted_at IS NULL
      ORDER BY rfm.credit_utilization_percentage DESC
      LIMIT ${limit}
    `;

    return retailers;
  }

  /**
   * Get retailers with poor payment behavior
   */
  async getPoorPaymentBehaviorRetailers(onTimeRatioThreshold = 50, limit = 50) {
    const retailers = await prisma.$queryRaw`
      SELECT 
        rfm.*,
        r.shop_name,
        r.retailer_code,
        u.name,
        u.phone_number
      FROM retailer_financial_metrics rfm
      JOIN retailers r ON rfm.retailer_id = r.id
      JOIN users u ON r.user_id = u.id
      WHERE rfm.on_time_payment_ratio < ${onTimeRatioThreshold}
      AND rfm.total_payments_made >= 3
      AND r.deleted_at IS NULL
      ORDER BY rfm.on_time_payment_ratio ASC
      LIMIT ${limit}
    `;

    return retailers;
  }

  /**
   * Get top performing retailers by order frequency
   */
  async getTopRetailersByFrequency(limit = 50) {
    const retailers = await prisma.$queryRaw`
      SELECT 
        rfm.*,
        r.shop_name,
        r.retailer_code,
        u.name,
        u.phone_number
      FROM retailer_financial_metrics rfm
      JOIN retailers r ON rfm.retailer_id = r.id
      JOIN users u ON r.user_id = u.id
      WHERE rfm.order_frequency_per_week > 0
      AND r.deleted_at IS NULL
      ORDER BY rfm.order_frequency_per_week DESC
      LIMIT ${limit}
    `;

    return retailers;
  }

  /**
   * Get retailers at risk (high utilization + poor payment behavior)
   */
  async getRiskRetailers(limit = 50) {
    const retailers = await prisma.$queryRaw`
      SELECT 
        rfm.*,
        r.shop_name,
        r.retailer_code,
        r.credit_score,
        u.name,
        u.phone_number,
        (rfm.credit_utilization_percentage * 0.6 + 
         (100 - rfm.on_time_payment_ratio) * 0.4) as risk_score
      FROM retailer_financial_metrics rfm
      JOIN retailers r ON rfm.retailer_id = r.id
      JOIN users u ON r.user_id = u.id
      WHERE rfm.credit_utilization_percentage > 70
      OR rfm.on_time_payment_ratio < 60
      AND r.deleted_at IS NULL
      ORDER BY risk_score DESC
      LIMIT ${limit}
    `;

    return retailers;
  }

  /**
   * Get metrics summary for dashboard
   */
  async getMetricsSummary() {
    const summary = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_retailers,
        AVG(credit_utilization_percentage) as avg_credit_utilization,
        AVG(on_time_payment_ratio) as avg_on_time_ratio,
        AVG(order_frequency_per_week) as avg_order_frequency,
        AVG(average_order_value) as avg_order_value,
        SUM(outstanding_credit) as total_outstanding,
        COUNT(CASE WHEN credit_utilization_percentage > 80 THEN 1 END) as high_utilization_count,
        COUNT(CASE WHEN on_time_payment_ratio < 50 THEN 1 END) as poor_payment_count
      FROM retailer_financial_metrics rfm
      JOIN retailers r ON rfm.retailer_id = r.id
      WHERE r.deleted_at IS NULL
    `;

    return summary[0];
  }

  /**
   * Recalculate metrics for all retailers (batch operation)
   * Use with caution - can be resource intensive
   */
  async recalculateAllMetrics() {
    try {
      logger.info('Starting batch recalculation of all retailer metrics');

      const results = await prisma.$queryRaw`
        SELECT * FROM recalculate_all_retailer_metrics()
      `;

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('Batch recalculation completed', {
        total: results.length,
        success: successCount,
        failures: failureCount,
      });

      return {
        total: results.length,
        success: successCount,
        failures: failureCount,
        results,
      };
    } catch (error) {
      logger.error('Batch recalculation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify metrics accuracy by recalculating and comparing
   */
  async verifyMetricsAccuracy(retailerId) {
    const currentMetrics = await this.getRetailerMetrics(retailerId);
    await this.calculateMetrics(retailerId);
    const recalculatedMetrics = await this.getRetailerMetrics(retailerId);

    const differences = {};
    const fields = [
      'total_orders_last_30_days',
      'total_purchase_value',
      'average_order_value',
      'payment_delay_average_days',
      'on_time_payment_ratio',
      'outstanding_credit',
      'credit_utilization_percentage',
      'order_frequency_per_week',
    ];

    fields.forEach(field => {
      const current = parseFloat(currentMetrics[field] || 0);
      const recalculated = parseFloat(recalculatedMetrics[field] || 0);
      const diff = Math.abs(current - recalculated);
      
      if (diff > 0.01) {
        differences[field] = {
          current,
          recalculated,
          difference: diff,
        };
      }
    });

    return {
      retailerId,
      accurate: Object.keys(differences).length === 0,
      differences,
    };
  }

  /**
   * Get metrics history trend (requires historical data tracking)
   * This is a placeholder for future enhancement
   */
  async getMetricsTrend(retailerId, days = 30) {
    // Future: Track metrics snapshots over time
    // For now, return current metrics
    return await this.getRetailerMetrics(retailerId);
  }

  /**
   * Export metrics for reporting
   */
  async exportMetrics(filters = {}) {
    let whereClause = 'WHERE r.deleted_at IS NULL';
    
    if (filters.minCreditUtilization) {
      whereClause += ` AND rfm.credit_utilization_percentage >= ${filters.minCreditUtilization}`;
    }
    
    if (filters.maxOnTimeRatio) {
      whereClause += ` AND rfm.on_time_payment_ratio <= ${filters.maxOnTimeRatio}`;
    }

    const metrics = await prisma.$queryRawUnsafe(`
      SELECT 
        r.retailer_code,
        r.shop_name,
        u.name as owner_name,
        u.phone_number,
        rfm.*
      FROM retailer_financial_metrics rfm
      JOIN retailers r ON rfm.retailer_id = r.id
      JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY rfm.total_purchase_value DESC
    `);

    return metrics;
  }
}

module.exports = new FinancialMetricsService();
