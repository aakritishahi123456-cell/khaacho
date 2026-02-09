const monitoringService = require('../services/monitoring.service');
const logger = require('../utils/logger');

/**
 * Monitoring Middleware
 * Tracks API requests and database queries
 */

/**
 * Track API requests
 */
function trackAPIRequests(req, res, next) {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Track in monitoring service
    monitoringService.trackAPIRequest(endpoint, statusCode, duration);

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow API request', {
        endpoint,
        duration: `${duration}ms`,
        statusCode,
        userId: req.user?.id,
      });
    }
  });

  next();
}

/**
 * Track database queries
 */
function trackDatabaseQueries() {
  const prisma = require('../config/database');

  // Hook into Prisma query events
  prisma.$on('query', (e) => {
    monitoringService.trackDatabaseQuery(e.duration);

    // Log slow queries
    if (e.duration > 1000) {
      logger.warn('Slow database query', {
        query: e.query,
        duration: `${e.duration}ms`,
        params: e.params,
      });
    }
  });
}

/**
 * Update system metrics periodically
 */
function startSystemMetricsCollection() {
  // Update every 30 seconds
  setInterval(() => {
    monitoringService.updateSystemMetrics();
  }, 30 * 1000);

  // Store snapshot every 5 minutes
  setInterval(() => {
    monitoringService.storeMetricsSnapshot();
  }, 5 * 60 * 1000);

  logger.info('System metrics collection started');
}

module.exports = {
  trackAPIRequests,
  trackDatabaseQueries,
  startSystemMetricsCollection,
};
