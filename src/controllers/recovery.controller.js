const recoveryService = require('../services/failureRecovery.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

class RecoveryController {
  /**
   * Get recovery dashboard
   */
  async getDashboard(req, res, next) {
    try {
      const stats = await recoveryService.getRecoveryDashboard();
      
      return ApiResponse.success(res, {
        stats,
        timestamp: new Date(),
      }, 'Recovery dashboard retrieved successfully');
    } catch (error) {
      logger.error('Failed to get recovery dashboard', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get recovery dashboard', 500);
    }
  }

  /**
   * Get pending webhook events
   */
  async getPendingWebhookEvents(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const events = await recoveryService.getPendingWebhookEvents(limit);
      
      return ApiResponse.success(res, {
        events,
        count: events.length,
      }, 'Pending webhook events retrieved successfully');
    } catch (error) {
      logger.error('Failed to get pending webhook events', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get pending webhook events', 500);
    }
  }

  /**
   * Get failed webhook events
   */
  async getFailedWebhookEvents(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const events = await recoveryService.getRetryableWebhookEvents(limit);
      
      return ApiResponse.success(res, {
        events,
        count: events.length,
      }, 'Failed webhook events retrieved successfully');
    } catch (error) {
      logger.error('Failed to get failed webhook events', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get failed webhook events', 500);
    }
  }

  /**
   * Get incomplete workflows
   */
  async getIncompleteWorkflows(req, res, next) {
    try {
      const workflowType = req.query.type || null;
      const workflows = await recoveryService.getIncompleteWorkflows(workflowType);
      
      return ApiResponse.success(res, {
        workflows,
        count: workflows.length,
      }, 'Incomplete workflows retrieved successfully');
    } catch (error) {
      logger.error('Failed to get incomplete workflows', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get incomplete workflows', 500);
    }
  }

  /**
   * Get pending order recoveries
   */
  async getPendingOrderRecoveries(req, res, next) {
    try {
      const recoveries = await recoveryService.getPendingOrderRecoveries();
      
      return ApiResponse.success(res, {
        recoveries,
        count: recoveries.length,
      }, 'Pending order recoveries retrieved successfully');
    } catch (error) {
      logger.error('Failed to get pending order recoveries', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get pending order recoveries', 500);
    }
  }

  /**
   * Get vendor assignment retries
   */
  async getVendorAssignmentRetries(req, res, next) {
    try {
      const orderId = parseInt(req.params.orderId);
      
      const retries = await prisma.$queryRaw`
        SELECT *
        FROM vendor_assignment_retries
        WHERE order_id = ${orderId}
        ORDER BY attempt_number ASC
      `;
      
      return ApiResponse.success(res, {
        retries,
        count: retries.length,
      }, 'Vendor assignment retries retrieved successfully');
    } catch (error) {
      logger.error('Failed to get vendor assignment retries', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to get vendor assignment retries', 500);
    }
  }

  /**
   * Manually trigger recovery
   */
  async triggerRecovery(req, res, next) {
    try {
      const { type } = req.body; // 'webhooks', 'workflows', 'orders', 'all'
      
      logger.info('Manual recovery triggered', { type, triggeredBy: req.user.id });
      
      // Import recovery worker
      const recoveryWorker = require('../workers/recovery.worker');
      
      // Trigger recovery (non-blocking)
      setImmediate(async () => {
        try {
          await recoveryWorker.runRecoveryTasks();
        } catch (error) {
          logger.error('Manual recovery failed', { error: error.message });
        }
      });
      
      return ApiResponse.success(res, {
        message: 'Recovery triggered successfully',
        type,
      }, 'Recovery process started');
    } catch (error) {
      logger.error('Failed to trigger recovery', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to trigger recovery', 500);
    }
  }

  /**
   * Run cleanup
   */
  async runCleanup(req, res, next) {
    try {
      logger.info('Manual cleanup triggered', { triggeredBy: req.user.id });
      
      await recoveryService.runCleanup();
      
      return ApiResponse.success(res, {
        message: 'Cleanup completed successfully',
      }, 'Cleanup completed');
    } catch (error) {
      logger.error('Failed to run cleanup', {
        error: error.message,
      });
      return ApiResponse.error(res, 'Failed to run cleanup', 500);
    }
  }
}

module.exports = new RecoveryController();
