const prisma = require('../config/database');
const logger = require('../utils/logger');
const { sendAlert } = require('./alerting.service');

/**
 * Monitoring Service
 * Tracks system metrics and triggers alerts for critical failures
 */

// In-memory metrics storage (for current window)
const metrics = {
  orders: {
    created: 0,
    failed: 0,
    lastHour: [],
  },
  jobs: {
    completed: 0,
    failed: 0,
    byQueue: {},
  },
  whatsapp: {
    sent: 0,
    failed: 0,
    deliveryFailed: 0,
  },
  api: {
    requests: 0,
    errors: 0,
    errorsByEndpoint: {},
  },
  database: {
    queries: 0,
    slowQueries: 0,
    totalLatency: 0,
    avgLatency: 0,
  },
  system: {
    uptime: Date.now(),
    lastHealthCheck: Date.now(),
    memory: {},
    cpu: {},
  },
};

// Alert thresholds
const THRESHOLDS = {
  ORDER_FAILURE_RATE: 0.1, // 10% failure rate
  JOB_FAILURE_RATE: 0.15, // 15% failure rate
  WHATSAPP_FAILURE_RATE: 0.2, // 20% failure rate
  API_ERROR_RATE: 0.05, // 5% error rate
  DATABASE_LATENCY_MS: 200, // 200ms average latency
  DATABASE_SLOW_QUERY_MS: 1000, // 1 second
  MEMORY_USAGE_PERCENT: 85, // 85% memory usage
  CPU_USAGE_PERCENT: 80, // 80% CPU usage
};

// ============================================================================
// METRIC TRACKING
// ============================================================================

/**
 * Track order creation
 */
function trackOrderCreated(orderId, success = true) {
  if (success) {
    metrics.orders.created++;
  } else {
    metrics.orders.failed++;
  }

  // Add to last hour tracking
  metrics.orders.lastHour.push({
    timestamp: Date.now(),
    success,
    orderId,
  });

  // Keep only last hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  metrics.orders.lastHour = metrics.orders.lastHour.filter(
    o => o.timestamp > oneHourAgo
  );

  // Check threshold
  checkOrderFailureRate();
}

/**
 * Track job completion
 */
function trackJobCompleted(queueName, jobId, success = true) {
  if (success) {
    metrics.jobs.completed++;
  } else {
    metrics.jobs.failed++;
  }

  // Track by queue
  if (!metrics.jobs.byQueue[queueName]) {
    metrics.jobs.byQueue[queueName] = {
      completed: 0,
      failed: 0,
    };
  }

  if (success) {
    metrics.jobs.byQueue[queueName].completed++;
  } else {
    metrics.jobs.byQueue[queueName].failed++;
  }

  // Check threshold
  checkJobFailureRate(queueName);
}

/**
 * Track WhatsApp message
 */
function trackWhatsAppMessage(messageId, status) {
  switch (status) {
    case 'sent':
      metrics.whatsapp.sent++;
      break;
    case 'failed':
      metrics.whatsapp.failed++;
      checkWhatsAppFailureRate();
      break;
    case 'delivery_failed':
      metrics.whatsapp.deliveryFailed++;
      checkWhatsAppDeliveryFailureRate();
      break;
  }
}

/**
 * Track API request
 */
function trackAPIRequest(endpoint, statusCode, responseTime) {
  metrics.api.requests++;

  // Track errors (4xx and 5xx)
  if (statusCode >= 400) {
    metrics.api.errors++;

    // Track by endpoint
    if (!metrics.api.errorsByEndpoint[endpoint]) {
      metrics.api.errorsByEndpoint[endpoint] = 0;
    }
    metrics.api.errorsByEndpoint[endpoint]++;

    // Check threshold
    checkAPIErrorRate();
  }
}

/**
 * Track database query
 */
function trackDatabaseQuery(duration) {
  metrics.database.queries++;
  metrics.database.totalLatency += duration;
  metrics.database.avgLatency = 
    metrics.database.totalLatency / metrics.database.queries;

  // Track slow queries
  if (duration > THRESHOLDS.DATABASE_SLOW_QUERY_MS) {
    metrics.database.slowQueries++;
  }

  // Check threshold
  checkDatabaseLatency();
}

/**
 * Update system metrics
 */
function updateSystemMetrics() {
  const usage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  metrics.system.memory = {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    rss: usage.rss,
    usagePercent: (usage.heapUsed / usage.heapTotal) * 100,
  };

  metrics.system.cpu = {
    user: cpuUsage.user,
    system: cpuUsage.system,
  };

  metrics.system.lastHealthCheck = Date.now();

  // Check thresholds
  checkMemoryUsage();
}

// ============================================================================
// THRESHOLD CHECKS
// ============================================================================

/**
 * Check order failure rate
 */
function checkOrderFailureRate() {
  const total = metrics.orders.created + metrics.orders.failed;
  if (total === 0) return;

  const failureRate = metrics.orders.failed / total;

  if (failureRate > THRESHOLDS.ORDER_FAILURE_RATE) {
    sendAlert('critical', 'Order Failure Rate High', {
      failureRate: `${(failureRate * 100).toFixed(2)}%`,
      threshold: `${(THRESHOLDS.ORDER_FAILURE_RATE * 100).toFixed(2)}%`,
      totalOrders: total,
      failedOrders: metrics.orders.failed,
    });
  }
}

/**
 * Check job failure rate
 */
function checkJobFailureRate(queueName) {
  const queueMetrics = metrics.jobs.byQueue[queueName];
  if (!queueMetrics) return;

  const total = queueMetrics.completed + queueMetrics.failed;
  if (total === 0) return;

  const failureRate = queueMetrics.failed / total;

  if (failureRate > THRESHOLDS.JOB_FAILURE_RATE) {
    sendAlert('high', 'Job Failure Rate High', {
      queue: queueName,
      failureRate: `${(failureRate * 100).toFixed(2)}%`,
      threshold: `${(THRESHOLDS.JOB_FAILURE_RATE * 100).toFixed(2)}%`,
      totalJobs: total,
      failedJobs: queueMetrics.failed,
    });
  }
}

/**
 * Check WhatsApp failure rate
 */
function checkWhatsAppFailureRate() {
  const total = metrics.whatsapp.sent + metrics.whatsapp.failed;
  if (total === 0) return;

  const failureRate = metrics.whatsapp.failed / total;

  if (failureRate > THRESHOLDS.WHATSAPP_FAILURE_RATE) {
    sendAlert('high', 'WhatsApp Send Failure Rate High', {
      failureRate: `${(failureRate * 100).toFixed(2)}%`,
      threshold: `${(THRESHOLDS.WHATSAPP_FAILURE_RATE * 100).toFixed(2)}%`,
      totalMessages: total,
      failedMessages: metrics.whatsapp.failed,
    });
  }
}

/**
 * Check WhatsApp delivery failure rate
 */
function checkWhatsAppDeliveryFailureRate() {
  const total = metrics.whatsapp.sent;
  if (total === 0) return;

  const failureRate = metrics.whatsapp.deliveryFailed / total;

  if (failureRate > THRESHOLDS.WHATSAPP_FAILURE_RATE) {
    sendAlert('medium', 'WhatsApp Delivery Failure Rate High', {
      failureRate: `${(failureRate * 100).toFixed(2)}%`,
      threshold: `${(THRESHOLDS.WHATSAPP_FAILURE_RATE * 100).toFixed(2)}%`,
      totalMessages: total,
      deliveryFailed: metrics.whatsapp.deliveryFailed,
    });
  }
}

/**
 * Check API error rate
 */
function checkAPIErrorRate() {
  if (metrics.api.requests === 0) return;

  const errorRate = metrics.api.errors / metrics.api.requests;

  if (errorRate > THRESHOLDS.API_ERROR_RATE) {
    sendAlert('high', 'API Error Rate High', {
      errorRate: `${(errorRate * 100).toFixed(2)}%`,
      threshold: `${(THRESHOLDS.API_ERROR_RATE * 100).toFixed(2)}%`,
      totalRequests: metrics.api.requests,
      errors: metrics.api.errors,
      topErrorEndpoints: getTopErrorEndpoints(5),
    });
  }
}

/**
 * Check database latency
 */
function checkDatabaseLatency() {
  if (metrics.database.avgLatency > THRESHOLDS.DATABASE_LATENCY_MS) {
    sendAlert('medium', 'Database Latency High', {
      avgLatency: `${metrics.database.avgLatency.toFixed(2)}ms`,
      threshold: `${THRESHOLDS.DATABASE_LATENCY_MS}ms`,
      totalQueries: metrics.database.queries,
      slowQueries: metrics.database.slowQueries,
    });
  }
}

/**
 * Check memory usage
 */
function checkMemoryUsage() {
  const usagePercent = metrics.system.memory.usagePercent;

  if (usagePercent > THRESHOLDS.MEMORY_USAGE_PERCENT) {
    sendAlert('high', 'Memory Usage High', {
      usagePercent: `${usagePercent.toFixed(2)}%`,
      threshold: `${THRESHOLDS.MEMORY_USAGE_PERCENT}%`,
      heapUsed: `${(metrics.system.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      heapTotal: `${(metrics.system.memory.heapTotal / 1024 / 1024).toFixed(2)}MB`,
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get top error endpoints
 */
function getTopErrorEndpoints(limit = 5) {
  return Object.entries(metrics.api.errorsByEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([endpoint, count]) => ({ endpoint, count }));
}

/**
 * Get order creation rate (orders per hour)
 */
function getOrderCreationRate() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const ordersLastHour = metrics.orders.lastHour.filter(
    o => o.timestamp > oneHourAgo
  );
  return ordersLastHour.length;
}

/**
 * Get current metrics snapshot
 */
function getMetricsSnapshot() {
  return {
    orders: {
      created: metrics.orders.created,
      failed: metrics.orders.failed,
      failureRate: metrics.orders.created + metrics.orders.failed > 0
        ? (metrics.orders.failed / (metrics.orders.created + metrics.orders.failed) * 100).toFixed(2) + '%'
        : '0%',
      creationRate: getOrderCreationRate(),
    },
    jobs: {
      completed: metrics.jobs.completed,
      failed: metrics.jobs.failed,
      failureRate: metrics.jobs.completed + metrics.jobs.failed > 0
        ? (metrics.jobs.failed / (metrics.jobs.completed + metrics.jobs.failed) * 100).toFixed(2) + '%'
        : '0%',
      byQueue: metrics.jobs.byQueue,
    },
    whatsapp: {
      sent: metrics.whatsapp.sent,
      failed: metrics.whatsapp.failed,
      deliveryFailed: metrics.whatsapp.deliveryFailed,
      failureRate: metrics.whatsapp.sent + metrics.whatsapp.failed > 0
        ? (metrics.whatsapp.failed / (metrics.whatsapp.sent + metrics.whatsapp.failed) * 100).toFixed(2) + '%'
        : '0%',
    },
    api: {
      requests: metrics.api.requests,
      errors: metrics.api.errors,
      errorRate: metrics.api.requests > 0
        ? (metrics.api.errors / metrics.api.requests * 100).toFixed(2) + '%'
        : '0%',
      topErrorEndpoints: getTopErrorEndpoints(5),
    },
    database: {
      queries: metrics.database.queries,
      slowQueries: metrics.database.slowQueries,
      avgLatency: `${metrics.database.avgLatency.toFixed(2)}ms`,
    },
    system: {
      uptime: Math.floor((Date.now() - metrics.system.uptime) / 1000),
      memory: {
        usagePercent: `${metrics.system.memory.usagePercent?.toFixed(2)}%`,
        heapUsed: `${((metrics.system.memory.heapUsed || 0) / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${((metrics.system.memory.heapTotal || 0) / 1024 / 1024).toFixed(2)}MB`,
      },
      lastHealthCheck: new Date(metrics.system.lastHealthCheck).toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get system health status
 */
function getSystemHealth() {
  const snapshot = getMetricsSnapshot();
  
  // Calculate health score (0-100)
  let healthScore = 100;
  const issues = [];

  // Check order failure rate
  const orderFailureRate = parseFloat(snapshot.orders.failureRate);
  if (orderFailureRate > THRESHOLDS.ORDER_FAILURE_RATE * 100) {
    healthScore -= 20;
    issues.push({
      severity: 'critical',
      message: `Order failure rate (${snapshot.orders.failureRate}) exceeds threshold`,
    });
  }

  // Check job failure rate
  const jobFailureRate = parseFloat(snapshot.jobs.failureRate);
  if (jobFailureRate > THRESHOLDS.JOB_FAILURE_RATE * 100) {
    healthScore -= 15;
    issues.push({
      severity: 'high',
      message: `Job failure rate (${snapshot.jobs.failureRate}) exceeds threshold`,
    });
  }

  // Check API error rate
  const apiErrorRate = parseFloat(snapshot.api.errorRate);
  if (apiErrorRate > THRESHOLDS.API_ERROR_RATE * 100) {
    healthScore -= 15;
    issues.push({
      severity: 'high',
      message: `API error rate (${snapshot.api.errorRate}) exceeds threshold`,
    });
  }

  // Check database latency
  const dbLatency = parseFloat(snapshot.database.avgLatency);
  if (dbLatency > THRESHOLDS.DATABASE_LATENCY_MS) {
    healthScore -= 10;
    issues.push({
      severity: 'medium',
      message: `Database latency (${snapshot.database.avgLatency}) exceeds threshold`,
    });
  }

  // Check memory usage
  const memoryUsage = parseFloat(snapshot.system.memory.usagePercent);
  if (memoryUsage > THRESHOLDS.MEMORY_USAGE_PERCENT) {
    healthScore -= 10;
    issues.push({
      severity: 'high',
      message: `Memory usage (${snapshot.system.memory.usagePercent}) exceeds threshold`,
    });
  }

  // Determine status
  let status = 'healthy';
  if (healthScore < 50) {
    status = 'critical';
  } else if (healthScore < 70) {
    status = 'degraded';
  } else if (healthScore < 90) {
    status = 'warning';
  }

  return {
    status,
    healthScore,
    issues,
    metrics: snapshot,
    thresholds: THRESHOLDS,
  };
}

/**
 * Reset metrics (for testing or periodic reset)
 */
function resetMetrics() {
  metrics.orders.created = 0;
  metrics.orders.failed = 0;
  metrics.orders.lastHour = [];
  
  metrics.jobs.completed = 0;
  metrics.jobs.failed = 0;
  metrics.jobs.byQueue = {};
  
  metrics.whatsapp.sent = 0;
  metrics.whatsapp.failed = 0;
  metrics.whatsapp.deliveryFailed = 0;
  
  metrics.api.requests = 0;
  metrics.api.errors = 0;
  metrics.api.errorsByEndpoint = {};
  
  metrics.database.queries = 0;
  metrics.database.slowQueries = 0;
  metrics.database.totalLatency = 0;
  metrics.database.avgLatency = 0;

  logger.info('Metrics reset');
}

/**
 * Store metrics snapshot to database
 */
async function storeMetricsSnapshot() {
  try {
    const snapshot = getMetricsSnapshot();
    
    await prisma.$queryRaw`
      INSERT INTO system_metrics (
        metric_type,
        metric_data,
        timestamp
      ) VALUES (
        'snapshot',
        ${JSON.stringify(snapshot)}::jsonb,
        CURRENT_TIMESTAMP
      )
    `;

    logger.debug('Metrics snapshot stored');
  } catch (error) {
    logger.error('Failed to store metrics snapshot', {
      error: error.message,
    });
  }
}

module.exports = {
  // Tracking functions
  trackOrderCreated,
  trackJobCompleted,
  trackWhatsAppMessage,
  trackAPIRequest,
  trackDatabaseQuery,
  updateSystemMetrics,
  
  // Metrics retrieval
  getMetricsSnapshot,
  getSystemHealth,
  
  // Management
  resetMetrics,
  storeMetricsSnapshot,
  
  // Thresholds (for configuration)
  THRESHOLDS,
};
