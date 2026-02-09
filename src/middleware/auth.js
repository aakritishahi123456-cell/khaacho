const jwt = require('jsonwebtoken');
const config = require('../config');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

/**
 * Enhanced Authentication & Authorization Middleware
 * Strict role-based access control with logging
 */

/**
 * Authenticate user from JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path,
      });
      throw new AuthenticationError('No token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
      },
    });

    // Check if user exists
    if (!user) {
      logger.warn('Authentication failed: User not found', {
        userId: decoded.userId,
        ip: req.ip,
      });
      throw new AuthenticationError('Invalid token');
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Authentication failed: User inactive', {
        userId: user.id,
        ip: req.ip,
      });
      throw new AuthenticationError('User account is inactive');
    }

    // Check if user is approved (for vendors/retailers)
    if ((user.role === 'VENDOR' || user.role === 'RETAILER') && !user.isApproved) {
      logger.warn('Authentication failed: User not approved', {
        userId: user.id,
        role: user.role,
        ip: req.ip,
      });
      throw new AuthenticationError('User account is not approved');
    }

    // Attach user to request
    req.user = user;
    
    // Log successful authentication (debug level)
    logger.debug('User authenticated', {
      userId: user.id,
      role: user.role,
      path: req.path,
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Authentication failed: Invalid token', {
        ip: req.ip,
        error: error.message,
      });
      return next(new AuthenticationError('Invalid token'));
    }
    
    if (error.name === 'TokenExpiredError') {
      logger.warn('Authentication failed: Token expired', {
        ip: req.ip,
      });
      return next(new AuthenticationError('Token expired'));
    }

    next(error);
  }
};

/**
 * Authorize user based on roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Authorization check without authentication', {
        path: req.path,
      });
      return next(new AuthenticationError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
        method: req.method,
      });
      return next(new AuthorizationError('Insufficient permissions'));
    }

    // Log authorization success (debug level)
    logger.debug('User authorized', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
    });

    next();
  };
};

/**
 * Check if user owns the resource
 */
const authorizeOwner = (resourceIdParam = 'id', resourceType = 'user') => {
  return async (req, res, next) => {
    try {
      const resourceId = parseInt(req.params[resourceIdParam]);
      const userId = req.user.id;

      // Admins can access any resource
      if (req.user.role === 'ADMIN') {
        return next();
      }

      // Check ownership based on resource type
      let isOwner = false;

      switch (resourceType) {
        case 'user':
          isOwner = resourceId === userId;
          break;

        case 'order':
          const order = await prisma.orders.findUnique({
            where: { id: resourceId },
            select: { retailerId: true, vendorId: true },
          });
          isOwner = order && (
            (req.user.role === 'RETAILER' && order.retailerId === userId) ||
            (req.user.role === 'VENDOR' && order.vendorId === userId)
          );
          break;

        case 'retailer':
          isOwner = req.user.role === 'RETAILER' && resourceId === userId;
          break;

        case 'vendor':
          isOwner = req.user.role === 'VENDOR' && resourceId === userId;
          break;

        default:
          isOwner = false;
      }

      if (!isOwner) {
        logger.warn('Authorization failed: Not resource owner', {
          userId,
          resourceType,
          resourceId,
          path: req.path,
        });
        return next(new AuthorizationError('You do not have access to this resource'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        phoneNumber: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Ignore errors for optional auth
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeOwner,
  optionalAuth,
};
