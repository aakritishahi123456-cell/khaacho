const monitoringService = require('../services/monitoring.service');
const alertingService = require('../services/alerting.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

class MonitoringController {
  /**
   * Get system health
   */
  async getSystemHealth(req, res, next) {
    try {
      const health = monitoringService.getSystemHealth();
      
      return ApiResponse.success(res, health, 'System health retrieved successfully');
    } catch (error) {
      logger.error('Failed to get system health', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get system health', 500);
    }
  }

  /**
   * Get metrics snapshot
   */
  async getMetrics(req, res, next) {
    try {
      const metrics = monitoringService.getMetricsSnapshot();
      
      return ApiResponse.success(res, metrics, 'Metrics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get metrics', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get metrics', 500);
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const alerts = await alertingService.getActiveAlerts(limit);
      
      return ApiResponse.success(res, {
        alerts,
        count: alerts.length,
      }, 'Active alerts retrieved successfully');
    } catch (error) {
      logger.error('Failed to get active alerts', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get active alerts', 500);
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(req, res, next) {
    try {
      const alertId = parseInt(req.params.alertId);
      const acknowledgedBy = req.user.id;

      const success = await alertingService.acknowledgeAlert(alertId, acknowledgedBy);

      if (success) {
        return ApiResponse.success(res, {
          alertId,
          acknowledgedBy,
        }, 'Alert acknowledged successfully');
      } else {
        return ApiResponse.error(res, 'Failed to acknowledge alert', 500);
      }
    } catch (error) {
      logger.error('Failed to acknowledge alert', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to acknowledge alert', 500);
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(req, res, next) {
    try {
      const alertId = parseInt(req.params.alertId);
      const resolvedBy = req.user.id;
      const { resolution } = req.body;

      if (!resolution) {
        return ApiResponse.error(res, 'Resolution message is required', 400);
      }

      const success = await alertingService.resolveAlert(alertId, resolvedBy, resolution);

      if (success) {
        return ApiResponse.success(res, {
          alertId,
          resolvedBy,
          resolution,
        }, 'Alert resolved successfully');
      } else {
        return ApiResponse.error(res, 'Failed to resolve alert', 500);
      }
    } catch (error) {
      logger.error('Failed to resolve alert', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to resolve alert', 500);
    }
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      
      const stats = await alertingService.getAlertStatistics(startDate, endDate);
      
      return ApiResponse.success(res, {
        stats,
        period: {
          startDate: startDate || 'all time',
          endDate: endDate || 'now',
        },
      }, 'Alert statistics retrieved successfully');
    } catch (error) {
      logger.error('Failed to get alert statistics', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get alert statistics', 500);
    }
  }

  /**
   * Reset metrics (admin only, for testing)
   */
  async resetMetrics(req, res, next) {
    try {
      monitoringService.resetMetrics();
      
      logger.info('Metrics reset by admin', {
        userId: req.user.id,
      });
      
      return ApiResponse.success(res, {
        message: 'Metrics reset successfully',
      }, 'Metrics reset');
    } catch (error) {
      logger.error('Failed to reset metrics', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to reset metrics', 500);
    }
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboard(req, res, next) {
    try {
      const health = monitoringService.getSystemHealth();
      const metrics = monitoringService.getMetricsSnapshot();
      const alerts = await alertingService.getActiveAlerts(10);
      const alertStats = await alertingService.getAlertStatistics();

      return ApiResponse.success(res, {
        health,
        metrics,
        recentAlerts: alerts,
        alertStatistics: alertStats,
      }, 'Dashboard data retrieved successfully');
    } catch (error) {
      logger.error('Failed to get dashboard data', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get dashboard data', 500);
    }
  }
}

module.exports = new MonitoringController();
