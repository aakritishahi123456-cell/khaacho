const logger = require('./logger');
const config = require('../config');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTimes: [],
      dbQueries: 0,
      whatsappMessages: 0,
    };
    
    if (config.performance.enableMetrics) {
      this.startMonitoring();
    }
  }

  startMonitoring() {
    setInterval(() => {
      this.logMetrics();
      this.resetMetrics();
    }, config.performance.metricsInterval);
  }

  recordRequest(duration) {
    this.metrics.requests++;
    this.metrics.responseTimes.push(duration);
  }

  recordError() {
    this.metrics.errors++;
  }

  recordDbQuery() {
    this.metrics.dbQueries++;
  }

  recordWhatsAppMessage() {
    this.metrics.whatsappMessages++;
  }

  logMetrics() {
    if (this.metrics.requests === 0) return;

    const avgResponseTime = this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
    const p95 = this.calculatePercentile(this.metrics.responseTimes, 95);
    const p99 = this.calculatePercentile(this.metrics.responseTimes, 99);

    logger.info('Performance metrics', {
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2) + '%',
      avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
      p95ResponseTime: p95.toFixed(2) + 'ms',
      p99ResponseTime: p99.toFixed(2) + 'ms',
      dbQueries: this.metrics.dbQueries,
      whatsappMessages: this.metrics.whatsappMessages,
      memory: process.memoryUsage(),
    });
  }

  calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  resetMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTimes: [],
      dbQueries: 0,
      whatsappMessages: 0,
    };
  }
}

const performanceMonitor = new PerformanceMonitor();

// Middleware to track request performance
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    performanceMonitor.recordRequest(duration);

    if (res.statusCode >= 400) {
      performanceMonitor.recordError();
    }

    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
        statusCode: res.statusCode,
      });
    }
  });

  next();
};

module.exports = {
  performanceMonitor,
  performanceMiddleware,
};
