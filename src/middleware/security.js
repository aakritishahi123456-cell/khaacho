const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Security Middleware
 * Provides rate limiting, webhook verification, and security headers
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs || 15 * 60 * 1000, // 15 minutes
  max: config.rateLimit.maxRequests || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },
});

/**
 * Strict rate limiter for auth endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
  },
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body.email,
    });
    res.status(429).json({
      success: false,
      message: 'Too many login attempts, account temporarily locked',
    });
  },
});

/**
 * Webhook rate limiter
 */
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 webhooks per minute
  message: {
    success: false,
    message: 'Webhook rate limit exceeded',
  },
});

/**
 * Admin action rate limiter
 */
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 admin actions per minute
  message: {
    success: false,
    message: 'Too many admin actions, please slow down',
  },
});

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

/**
 * Verify WhatsApp webhook signature
 */
function verifyWhatsAppWebhook(req, res, next) {
  try {
    // For GET requests (webhook verification)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
        logger.info('WhatsApp webhook verified');
        return res.status(200).send(challenge);
      }

      logger.warn('WhatsApp webhook verification failed', {
        mode,
        tokenMatch: token === config.whatsapp.verifyToken,
      });
      return res.sendStatus(403);
    }

    // For POST requests (webhook events)
    const signature = req.headers['x-hub-signature-256'];
    
    if (!signature) {
      logger.warn('WhatsApp webhook missing signature');
      return res.sendStatus(401);
    }

    // Verify signature if app secret is configured
    if (config.whatsapp.appSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', config.whatsapp.appSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== `sha256=${expectedSignature}`) {
        logger.warn('WhatsApp webhook signature mismatch');
        return res.sendStatus(401);
      }
    }

    next();
  } catch (error) {
    logger.error('WhatsApp webhook verification error', {
      error: error.message,
    });
    return res.sendStatus(500);
  }
}

/**
 * Generic webhook signature verification
 */
function verifyWebhookSignature(secret) {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-webhook-signature'];
      
      if (!signature) {
        logger.warn('Webhook missing signature', {
          path: req.path,
        });
        return res.sendStatus(401);
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn('Webhook signature mismatch', {
          path: req.path,
        });
        return res.sendStatus(401);
      }

      next();
    } catch (error) {
      logger.error('Webhook verification error', {
        error: error.message,
      });
      return res.sendStatus(500);
    }
  };
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Add security headers
 */
function securityHeaders(req, res, next) {
  // Remove powered by header
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Content Security Policy
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );
  }

  next();
}

// ============================================================================
// IP WHITELIST/BLACKLIST
// ============================================================================

/**
 * IP whitelist middleware
 */
function ipWhitelist(allowedIPs) {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn('IP not whitelisted', {
        ip: clientIP,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    next();
  };
}

/**
 * IP blacklist middleware
 */
function ipBlacklist(blockedIPs) {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (blockedIPs.includes(clientIP)) {
      logger.warn('Blocked IP attempted access', {
        ip: clientIP,
        path: req.path,
      });
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    next();
  };
}

// ============================================================================
// REQUEST SANITIZATION
// ============================================================================

/**
 * Sanitize request body to prevent injection attacks
 */
function sanitizeRequest(req, res, next) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
}

/**
 * Recursively sanitize object
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    // Remove potentially dangerous keys
    if (key.startsWith('$') || key.startsWith('_')) {
      continue;
    }

    // Sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else if (typeof value === 'string') {
      // Remove null bytes and control characters
      sanitized[key] = value.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

/**
 * CORS options for production
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // In production, check against whitelist
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Allow all in development
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

module.exports = {
  // Rate limiters
  apiLimiter,
  authLimiter,
  webhookLimiter,
  adminLimiter,

  // Webhook verification
  verifyWhatsAppWebhook,
  verifyWebhookSignature,

  // Security
  securityHeaders,
  ipWhitelist,
  ipBlacklist,
  sanitizeRequest,
  corsOptions,
};
