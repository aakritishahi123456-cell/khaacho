/**
 * Web Server Entry Point
 * Handles HTTP requests only, no background workers
 */

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
// EXPRESS APP INITIALIZATION
// ============================================================================

const app = express();

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

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

app.use(cors(corsOptions));
app.use(compression());
app.use(securityHeaders);
app.use(sanitizeRequest);
app.use('/api', apiLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// ============================================================================
// MONITORING MIDDLEWARE
// ============================================================================

app.use(trackAPIRequests);
trackDatabaseQueries();

// Request logging
app.use((req, res, next) => {
  const startTime = Date.now();
  
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
  });

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

// ============================================================================
// ROUTES
// ============================================================================

app.use(`/api/${config.apiVersion}`, routes);

app.get('/', (req, res) => {
  res.redirect('/admin/login.html');
});

// 404 handler
app.use(errorHandler.notFoundHandler);

// Error handler
app.use(errorHandler);

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = config.port;
const server = app.listen(PORT, () => {
  logger.info(`Khaacho Web Service running on port ${PORT}`);
  logger.info(`Environment: ${config.env}`);
  logger.info(`Admin panel: http://localhost:${PORT}/admin`);
  logger.info('Background jobs: DISABLED (handled by worker service)');
  
  // Start system metrics collection
  startSystemMetricsCollection();
  logger.info('System metrics collection started');
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Give existing requests time to complete
  setTimeout(() => {
    logger.info('Forcing shutdown');
    process.exit(0);
  }, 10000); // 10 second timeout
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

module.exports = app;
