const { body, param, query, validationResult } = require('express-validator');

/**
 * Input Validation Utilities
 * Provides reusable validation rules and middleware
 */

/**
 * Validation error handler middleware
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  
  next();
}

/**
 * Common validation rules
 */
const commonRules = {
  // ID validation
  id: param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer'),

  // Pagination
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  // Email
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address'),

  // Password
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),

  // Phone number
  phone: body('phone')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Invalid phone number format'),

  // Name
  name: body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  // Amount
  amount: body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number'),

  // Date
  date: body('date')
    .isISO8601()
    .withMessage('Invalid date format (use ISO 8601)'),

  // Status
  orderStatus: body('status')
    .isIn(['DRAFT', 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
    .withMessage('Invalid order status'),

  paymentStatus: body('paymentStatus')
    .isIn(['PENDING', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'])
    .withMessage('Invalid payment status'),

  // Role
  role: body('role')
    .isIn(['ADMIN', 'VENDOR', 'RETAILER'])
    .withMessage('Invalid role'),

  // Boolean
  boolean: (field) => body(field)
    .isBoolean()
    .withMessage(`${field} must be a boolean`),

  // Array
  array: (field, minLength = 1) => body(field)
    .isArray({ min: minLength })
    .withMessage(`${field} must be an array with at least ${minLength} item(s)`),

  // String
  string: (field, minLength = 1, maxLength = 255) => body(field)
    .trim()
    .isLength({ min: minLength, max: maxLength })
    .withMessage(`${field} must be between ${minLength} and ${maxLength} characters`),

  // Integer
  integer: (field, min = 1) => body(field)
    .isInt({ min })
    .withMessage(`${field} must be an integer >= ${min}`),

  // Float
  float: (field, min = 0) => body(field)
    .isFloat({ min })
    .withMessage(`${field} must be a number >= ${min}`),
};

/**
 * Sanitization rules
 */
const sanitize = {
  // Remove HTML tags
  stripTags: (field) => body(field).escape(),

  // Trim whitespace
  trim: (field) => body(field).trim(),

  // Convert to lowercase
  lowercase: (field) => body(field).toLowerCase(),

  // Convert to uppercase
  uppercase: (field) => body(field).toUpperCase(),

  // Convert to boolean
  toBoolean: (field) => body(field).toBoolean(),

  // Convert to integer
  toInt: (field) => body(field).toInt(),

  // Convert to float
  toFloat: (field) => body(field).toFloat(),
};

/**
 * Validation rule sets for common operations
 */
const validationRules = {
  // Auth
  register: [
    commonRules.email,
    commonRules.password,
    commonRules.name,
    commonRules.phone,
    commonRules.role,
    handleValidationErrors,
  ],

  login: [
    commonRules.email,
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],

  // Orders
  createOrder: [
    body('retailerId').isInt({ min: 1 }).withMessage('Invalid retailer ID'),
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.productId').isInt({ min: 1 }).withMessage('Invalid product ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('items.*.price').isFloat({ min: 0.01 }).withMessage('Price must be positive'),
    body('paymentMethod').isIn(['CASH', 'CREDIT', 'BANK_TRANSFER']).withMessage('Invalid payment method'),
    handleValidationErrors,
  ],

  updateOrderStatus: [
    commonRules.id,
    commonRules.orderStatus,
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long'),
    handleValidationErrors,
  ],

  // Products
  createProduct: [
    commonRules.string('name', 2, 200),
    commonRules.string('category', 2, 100),
    body('subCategory').optional().trim().isLength({ max: 100 }),
    body('unit').isIn(['KG', 'LITER', 'PIECE', 'BOX', 'DOZEN']).withMessage('Invalid unit'),
    commonRules.float('basePrice', 0.01),
    body('description').optional().trim().isLength({ max: 1000 }),
    handleValidationErrors,
  ],

  // Payments
  recordPayment: [
    body('orderId').isInt({ min: 1 }).withMessage('Invalid order ID'),
    commonRules.amount,
    body('paymentMethod').isIn(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY']).withMessage('Invalid payment method'),
    body('referenceNumber').optional().trim().isLength({ max: 100 }),
    body('notes').optional().trim().isLength({ max: 500 }),
    handleValidationErrors,
  ],

  // Pagination
  pagination: [
    commonRules.page,
    commonRules.limit,
    query('sortBy').optional().trim().isLength({ max: 50 }),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    handleValidationErrors,
  ],

  // ID parameter
  idParam: [
    commonRules.id,
    handleValidationErrors,
  ],
};

/**
 * Custom validators
 */
const customValidators = {
  // Check if value is unique in database
  isUnique: (model, field) => {
    return async (value) => {
      const prisma = require('../config/database');
      const existing = await prisma[model].findFirst({
        where: { [field]: value },
      });
      if (existing) {
        throw new Error(`${field} already exists`);
      }
      return true;
    };
  },

  // Check if value exists in database
  exists: (model, field = 'id') => {
    return async (value) => {
      const prisma = require('../config/database');
      const existing = await prisma[model].findFirst({
        where: { [field]: value },
      });
      if (!existing) {
        throw new Error(`${model} not found`);
      }
      return true;
    };
  },

  // Check if date is in future
  isFutureDate: (value) => {
    const date = new Date(value);
    if (date <= new Date()) {
      throw new Error('Date must be in the future');
    }
    return true;
  },

  // Check if date is in past
  isPastDate: (value) => {
    const date = new Date(value);
    if (date >= new Date()) {
      throw new Error('Date must be in the past');
    }
    return true;
  },
};

module.exports = {
  handleValidationErrors,
  commonRules,
  sanitize,
  validationRules,
  customValidators,
};
