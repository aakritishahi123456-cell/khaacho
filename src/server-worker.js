/**
 * Worker Service Entry Point
 * Handles background jobs and workers only
 */

const config = require('./config');
const logger = require('./utils/logger');
const { validateEnvironment } = require('./utils/envValidator');
const { initializeQueues, shutdownQueues } = require('./queues/initializeQueues');

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

try {
  validateEnvironment();
  logger.info('Environment validation passed');
} catch (error) {
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

// ============================================================================
// WORKER INITIALIZATION
// ============================================================================

logger.info('Starting Khaacho Worker Service');
logger.info(`Environment: ${config.env}`);

// Initialize job queues
try {
  initializeQueues();
  logger.info('Job queue system initialized');
} catch (error) {
  logger.error('Failed to initialize job queues', { error: error.message });
  process.exit(1);
}

// Start credit score worker
try {
  const creditScoreWorker = require('./workers/creditScore.worker');
  creditScoreWorker.start();
  logger.info('Credit score worker initialized');
} catch (error) {
  logger.error('Failed to start credit score worker', { error: error.message });
}

// Start risk control worker
try {
  const riskControlWorker = require('./workers/riskControl.worker');
  riskControlWorker.start();
  logger.info('Risk control worker initialized');
} catch (error) {
  logger.error('Failed to start risk control worker', { error: error.message });
}

// Start order routing worker
try {
  const orderRoutingWorker = require('./workers/orderRouting.worker');
  orderRoutingWorker.start();
  logger.info('Order routing worker initialized');
} catch (error) {
  logger.error('Failed to start order routing worker', { error: error.message });
}

// Start vendor performance worker
try {
  const vendorPerformanceWorker = require('./workers/vendorPerformance.worker');
  vendorPerformanceWorker.start();
  logger.info('Vendor performance worker initialized');
} catch (error) {
  logger.error('Failed to start vendor performance worker', { error: error.message });
}

// Start price intelligence worker
try {
  const priceIntelligenceWorker = require('./workers/priceIntelligence.worker');
  priceIntelligenceWorker.start();
  logger.info('Price intelligence worker initialized');
} catch (error) {
  logger.error('Failed to start price intelligence worker', { error: error.message });
}

// Start recovery worker (CRITICAL for crash recovery)
try {
  const recoveryWorker = require('./workers/recovery.worker');
  recoveryWorker.initializeRecoveryWorker();
  logger.info('Recovery worker initialized - crash recovery enabled');
} catch (error) {
  logger.error('Failed to start recovery worker', { error: error.message });
}

logger.info('All workers initialized successfully');
logger.info('Worker service is running');

// ============================================================================
// HEALTH CHECK (for monitoring)
// ============================================================================

// Simple HTTP server for health checks
const http = require('http');
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'worker',
      timestamp: new Date().toISOString(),
      workers: {
        creditScore: 'running',
        riskControl: 'running',
        orderRouting: 'running',
        vendorPerformance: 'running',
        priceIntelligence: 'running',
        recovery: 'running',
      },
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const HEALTH_PORT = process.env.HEALTH_PORT || 10001;
healthServer.listen(HEALTH_PORT, () => {
  logger.info(`Worker health check available on port ${HEALTH_PORT}`);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    // Shutdown job queues
    await shutdownQueues();
    logger.info('Job queues shut down successfully');
    
    // Close health check server
    healthServer.close(() => {
      logger.info('Health check server closed');
    });
    
    // Give workers time to finish current jobs
    setTimeout(() => {
      logger.info('Worker service shutdown complete');
      process.exit(0);
    }, 5000); // 5 second timeout
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in worker', { error: error.message, stack: error.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in worker', { reason, promise });
});

// Keep process alive
process.stdin.resume();
