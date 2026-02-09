const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const ApiResponse = require('../utils/response');

/**
 * Enhanced Error Handler with Production Security
 * Hides internal error details in production
 */

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log full error details (always)
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    name: err.name,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    body: sanitizeForLog(req.body),
  });

  // Prisma errors
  if (err.code === 'P2002') {
    error = new AppError('Duplicate field value entered', 409);
  }
  
  if (err.code === 'P2025') {
    error = new AppError('Record not found', 404);
  }

  if (err.code === 'P2003') {
    error = new AppError('Foreign key constraint failed', 400);
  }

  if (err.code === 'P2014') {
    error = new AppError('Invalid relation', 400);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    error = new AppError('File upload error', 400);
  }

  // Syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('Invalid JSON', 400);
  }

  const statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';

  // In production, hide internal error details
  if (process.env.NODE_ENV === 'production') {
    // Only show generic message for 500 errors
    if (statusCode === 500) {
      message = 'An unexpected error occurred. Please try again later.';
    }

    // Don't expose database errors
    if (err.code && err.code.startsWith('P')) {
      message = 'A database error occurred. Please contact support.';
    }

    // Return sanitized error
    return res.status(statusCode).json({
      success: false,
      message,
      errorId: generateErrorId(), // For support reference
    });
  }

  // In development, return full error details
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      statusCode,
      name: err.name,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
};

/**
 * Sanitize request body for logging
 */
function sanitizeForLog(body) {
  if (!body) return null;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Generate unique error ID for support reference
 */
function generateErrorId() {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

/**
 * Not found handler
 */
function notFoundHandler(req, res) {
  logger.warn('Route not found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
module.exports.asyncHandler = asyncHandler;
