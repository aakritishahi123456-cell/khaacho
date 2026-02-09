const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('../config');

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Rotating file transport for error logs
const errorRotateTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: true,
});

// Rotating file transport for combined logs
const combinedRotateTransport = new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '14d',
  zippedArchive: true,
});

// Rotating file transport for WhatsApp logs (high volume)
const whatsappRotateTransport = new DailyRotateFile({
  filename: 'logs/whatsapp-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '7d',
  zippedArchive: true,
  level: 'info',
});

// Rotating file transport for order logs (high volume)
const orderRotateTransport = new DailyRotateFile({
  filename: 'logs/orders-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  zippedArchive: true,
  level: 'info',
});

const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  defaultMeta: { 
    service: 'khaacho-platform',
    environment: config.env,
    hostname: require('os').hostname(),
  },
  transports: [
    errorRotateTransport,
    combinedRotateTransport,
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Console transport for development
if (config.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// Specialized loggers for high-volume operations
const whatsappLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: { service: 'whatsapp', environment: config.env },
  transports: [whatsappRotateTransport],
});

const orderLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  defaultMeta: { service: 'orders', environment: config.env },
  transports: [orderRotateTransport],
});

// Performance monitoring
logger.logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Performance metric', {
    operation,
    duration_ms: duration,
    ...metadata,
  });
};

// Error tracking with context
logger.logError = (error, context = {}) => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    ...context,
  });
};

module.exports = logger;
module.exports.whatsappLogger = whatsappLogger;
module.exports.orderLogger = orderLogger;
