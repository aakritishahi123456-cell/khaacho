const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { validateEnvironment } = require('./utils/envValidator');
const errorHandler = require('./middleware/errorHandler');
const { securityHeaders, sanitizeRequest, corsOptions, apiLimiter } = require('./middleware/security');
const { trackAPIRequests, trackDatabaseQueries, startSystemMetricsCollection } = require('./middleware/monitoring');
const routes = require('./routes');
const { initializeQueues, shutdownQueues } = require('./queues/initializeQueues');

// ============================================================================
// ENVIRONMENT VALIDATION (CRITICAL - Run before anything else)
// ============================================================================

try {
  validateEnvironment();
  logger.info('Environment validation passed');
} catch (error) {
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

// ============================================================================
// EXPRESS APP INITIALIZATION
// ============================================================================

const app = express();

// ============================================================================
// SECURITY MIDDLEWARE (Applied first)
// ============================================================================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  } : false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS with production configuration
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Custom security headers
app.use(securityHeaders);

// Request sanitization (prevent injection attacks)
app.use(sanitizeRequest);

// Rate limiting (applied to all API routes)
app.use('/api', apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (admin panel)
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// ============================================================================
// MONITORING MIDDLEWARE
// ============================================================================

// Track API requests (response time, status codes, error rates)
app.use(trackAPIRequests);

// Track database queries (latency monitoring)
trackDatabaseQueries();

// Request logging (after body parsing)
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });

  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path} completed`, {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
    });
  });

  next();
});

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin/login.html');
});

// 404 handler
app.use(errorHandler.notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Khaacho platform running on port ${PORT}`);
  logger.info(`Environment: ${config.env}`);
  logger.info(`Admin panel: http://localhost:${PORT}/admin`);
  
  // Initialize job queues
  try {
    initializeQueues();
    logger.info('Job queue system initialized');
  } catch (error) {
    logger.error('Failed to initialize job queues', { error: error.message });
  }
  
  // Start credit score worker
  const creditScoreWorker = require('./workers/creditScore.worker');
  creditScoreWorker.start();
  logger.info('Credit score worker initialized');
  
  // Start risk control worker
  const riskControlWorker = require('./workers/riskControl.worker');
  riskControlWorker.start();
  logger.info('Risk control worker initialized');
  
  // Start order routing worker
  const orderRoutingWorker = require('./workers/orderRouting.worker');
  orderRoutingWorker.start();
  logger.info('Order routing worker initialized');
  
  // Start vendor performance worker
  const vendorPerformanceWorker = require('./workers/vendorPerformance.worker');
  vendorPerformanceWorker.start();
  logger.info('Vendor performance worker initialized');
  
  // Start price intelligence worker
  const priceIntelligenceWorker = require('./workers/priceIntelligence.worker');
  priceIntelligenceWorker.start();
  logger.info('Price intelligence worker initialized');
  
  // Start recovery worker (CRITICAL for crash recovery)
  const recoveryWorker = require('./workers/recovery.worker');
  recoveryWorker.initializeRecoveryWorker();
  logger.info('Recovery worker initialized - crash recovery enabled');
  
  // Start system metrics collection (CPU, memory, disk)
  startSystemMetricsCollection();
  logger.info('System metrics collection started');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await shutdownQueues();
    logger.info('Job queues shut down successfully');
  } catch (error) {
    logger.error('Error shutting down job queues', { error: error.message });
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await shutdownQueues();
    logger.info('Job queues shut down successfully');
  } catch (error) {
    logger.error('Error shutting down job queues', { error: error.message });
  }
  
  process.exit(0);
});

module.exports = app;
