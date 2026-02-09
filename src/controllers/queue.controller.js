const jobQueueService = require('../services/jobQueue.service');
const { queueManager, QUEUES } = require('../queues/queueManager');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

class QueueController {
  /**
   * Get queue statistics
   * GET /api/v1/queues/stats
   */
  async getQueueStats(req, res) {
    try {
      const stats = await jobQueueService.getQueueStats();

      return successResponse(res, stats, 'Queue statistics retrieved successfully');
    } catch (error) {
      logger.error('Error getting queue stats', { error: error.message });
      return errorResponse(res, 'Failed to retrieve queue statistics', 500);
    }
  }

  /**
   * Get failed jobs for a queue
   * GET /api/v1/queues/:queueKey/failed
   */
  async getFailedJobs(req, res) {
    try {
      const { queueKey } = req.params;
      const { start = 0, end = 10 } = req.query;

      const jobs = await jobQueueService.getFailedJobs(
        queueKey,
        parseInt(start),
        parseInt(end)
      );

      return successResponse(res, {
        jobs,
        count: jobs.length,
      }, 'Failed jobs retrieved successfully');
    } catch (error) {
      logger.error('Error getting failed jobs', {
        error: error.message,
        queueKey: req.params.queueKey,
      });
      return errorResponse(res, 'Failed to retrieve failed jobs', 500);
    }
  }

  /**
   * Retry a failed job
   * POST /api/v1/queues/:queueKey/jobs/:jobId/retry
   */
  async retryJob(req, res) {
    try {
      const { queueKey, jobId } = req.params;

      await jobQueueService.retryFailedJob(queueKey, jobId);

      return successResponse(res, null, 'Job retry initiated successfully');
    } catch (error) {
      logger.error('Error retrying job', {
        error: error.message,
        queueKey: req.params.queueKey,
        jobId: req.params.jobId,
      });
      return errorResponse(res, 'Failed to retry job', 500);
    }
  }

  /**
   * Clean old jobs from a queue
   * POST /api/v1/queues/:queueKey/clean
   */
  async cleanQueue(req, res) {
    try {
      const { queueKey } = req.params;
      const { gracePeriodHours = 24 } = req.body;

      await jobQueueService.cleanOldJobs(queueKey, parseInt(gracePeriodHours));

      return successResponse(res, null, 'Queue cleaned successfully');
    } catch (error) {
      logger.error('Error cleaning queue', {
        error: error.message,
        queueKey: req.params.queueKey,
      });
      return errorResponse(res, 'Failed to clean queue', 500);
    }
  }

  /**
   * Pause a queue
   * POST /api/v1/queues/:queueKey/pause
   */
  async pauseQueue(req, res) {
    try {
      const { queueKey } = req.params;

      await queueManager.pauseQueue(queueKey);

      return successResponse(res, null, 'Queue paused successfully');
    } catch (error) {
      logger.error('Error pausing queue', {
        error: error.message,
        queueKey: req.params.queueKey,
      });
      return errorResponse(res, 'Failed to pause queue', 500);
    }
  }

  /**
   * Resume a queue
   * POST /api/v1/queues/:queueKey/resume
   */
  async resumeQueue(req, res) {
    try {
      const { queueKey } = req.params;

      await queueManager.resumeQueue(queueKey);

      return successResponse(res, null, 'Queue resumed successfully');
    } catch (error) {
      logger.error('Error resuming queue', {
        error: error.message,
        queueKey: req.params.queueKey,
      });
      return errorResponse(res, 'Failed to resume queue', 500);
    }
  }

  /**
   * Get available queue keys
   * GET /api/v1/queues/keys
   */
  async getQueueKeys(req, res) {
    try {
      return successResponse(res, {
        queues: Object.keys(QUEUES),
        queueNames: QUEUES,
      }, 'Queue keys retrieved successfully');
    } catch (error) {
      logger.error('Error getting queue keys', { error: error.message });
      return errorResponse(res, 'Failed to retrieve queue keys', 500);
    }
  }
}

module.exports = new QueueController();
