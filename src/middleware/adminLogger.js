const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Admin Action Logger Middleware
 * Logs all admin actions to audit_logs table
 */

/**
 * Log admin action
 */
async function logAdminAction(req, res, next) {
  // Only log if user is authenticated and is admin
  if (!req.user || req.user.role !== 'ADMIN') {
    return next();
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to capture response
  res.json = function(data) {
    // Log the action after response is sent
    setImmediate(async () => {
      try {
        await logAction(req, res, data);
      } catch (error) {
        logger.error('Failed to log admin action', {
          error: error.message,
          userId: req.user.id,
          action: req.method,
          path: req.path,
        });
      }
    });

    // Call original json method
    return originalJson(data);
  };

  next();
}

/**
 * Log action to database
 */
async function logAction(req, res, responseData) {
  try {
    const action = determineAction(req);
    const entityInfo = extractEntityInfo(req, responseData);

    await prisma.auditLogs.create({
      data: {
        userId: req.user.id,
        action,
        entityType: entityInfo.entityType,
        entityId: entityInfo.entityId,
        changes: {
          method: req.method,
          path: req.path,
          query: req.query,
          body: sanitizeBody(req.body),
          response: sanitizeResponse(responseData),
          statusCode: res.statusCode,
        },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        timestamp: new Date(),
      },
    });

    logger.info('Admin action logged', {
      userId: req.user.id,
      action,
      entityType: entityInfo.entityType,
      entityId: entityInfo.entityId,
      statusCode: res.statusCode,
    });
  } catch (error) {
    // Don't throw error, just log it
    logger.error('Failed to create audit log', {
      error: error.message,
    });
  }
}

/**
 * Determine action from request
 */
function determineAction(req) {
  const method = req.method;
  const path = req.path;

  // Map HTTP methods to actions
  const methodActions = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
    GET: 'VIEW',
  };

  let action = methodActions[method] || 'UNKNOWN';

  // Special cases
  if (path.includes('/approve')) action = 'APPROVE';
  if (path.includes('/reject')) action = 'REJECT';
  if (path.includes('/suspend')) action = 'SUSPEND';
  if (path.includes('/activate')) action = 'ACTIVATE';
  if (path.includes('/override')) action = 'OVERRIDE';
  if (path.includes('/export')) action = 'EXPORT';
  if (path.includes('/trigger')) action = 'TRIGGER';
  if (path.includes('/cleanup')) action = 'CLEANUP';

  return action;
}

/**
 * Extract entity information from request
 */
function extractEntityInfo(req, responseData) {
  const path = req.path;
  const params = req.params;
  const body = req.body;

  let entityType = 'UNKNOWN';
  let entityId = null;

  // Extract from path
  if (path.includes('/users')) entityType = 'USER';
  else if (path.includes('/orders')) entityType = 'ORDER';
  else if (path.includes('/products')) entityType = 'PRODUCT';
  else if (path.includes('/retailers')) entityType = 'RETAILER';
  else if (path.includes('/vendors')) entityType = 'VENDOR';
  else if (path.includes('/payments')) entityType = 'PAYMENT';
  else if (path.includes('/credit')) entityType = 'CREDIT';
  else if (path.includes('/risk-control')) entityType = 'RISK_CONTROL';
  else if (path.includes('/routing')) entityType = 'ORDER_ROUTING';
  else if (path.includes('/recovery')) entityType = 'RECOVERY';
  else if (path.includes('/queues')) entityType = 'JOB_QUEUE';

  // Extract ID from params
  if (params.id) {
    entityId = parseInt(params.id);
  } else if (params.orderId) {
    entityId = parseInt(params.orderId);
  } else if (params.userId) {
    entityId = parseInt(params.userId);
  } else if (params.vendorId) {
    entityId = parseInt(params.vendorId);
  } else if (params.retailerId) {
    entityId = parseInt(params.retailerId);
  }

  // Extract from body
  if (!entityId && body) {
    if (body.id) entityId = parseInt(body.id);
    else if (body.orderId) entityId = parseInt(body.orderId);
    else if (body.userId) entityId = parseInt(body.userId);
  }

  // Extract from response
  if (!entityId && responseData && responseData.data) {
    if (responseData.data.id) entityId = parseInt(responseData.data.id);
  }

  return { entityType, entityId };
}

/**
 * Sanitize request body for logging
 */
function sanitizeBody(body) {
  if (!body) return null;

  const sanitized = { ...body };

  // Remove sensitive fields
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'accessToken',
    'refreshToken',
  ];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Sanitize response for logging
 */
function sanitizeResponse(response) {
  if (!response) return null;

  // Only log success status and basic info
  return {
    success: response.success,
    message: response.message,
    // Don't log full data to keep logs small
  };
}

/**
 * Get admin action logs
 */
async function getAdminActionLogs(filters = {}, pagination = {}) {
  const {
    userId,
    action,
    entityType,
    startDate,
    endDate,
  } = filters;

  const {
    page = 1,
    limit = 50,
  } = pagination;

  const where = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLogs.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLogs.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get admin action statistics
 */
async function getAdminActionStats(startDate, endDate) {
  const where = {};
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = new Date(startDate);
    if (endDate) where.timestamp.lte = new Date(endDate);
  }

  const stats = await prisma.auditLogs.groupBy({
    by: ['action', 'entityType'],
    where,
    _count: true,
  });

  const userStats = await prisma.auditLogs.groupBy({
    by: ['userId'],
    where,
    _count: true,
    orderBy: {
      _count: {
        userId: 'desc',
      },
    },
    take: 10,
  });

  return {
    actionStats: stats,
    topUsers: userStats,
  };
}

module.exports = {
  logAdminAction,
  getAdminActionLogs,
  getAdminActionStats,
};
