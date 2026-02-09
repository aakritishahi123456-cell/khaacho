# Production Security Layer

## Overview

Comprehensive security implementation for production deployment with role-based access control, rate limiting, input validation, and secure error handling.

## Security Features

### 1. Environment Variable Validation ✅
**File**: `src/utils/envValidator.js`

**Features**:
- Validates all required environment variables on startup
- Type checking (string, number, boolean)
- Pattern matching (e.g., database URL format)
- Minimum length requirements
- Allowed values validation
- Production-specific security checks
- Weak secret detection

**Validated Variables**:
- `NODE_ENV`: Must be development/production/test
- `DATABASE_URL`: Must be valid PostgreSQL connection string
- `JWT_SECRET`: Minimum 32 characters (64 recommended for production)
- `WHATSAPP_VERIFY_TOKEN`: Minimum 16 characters (32 recommended)
- All other required configuration

**Startup Behavior**:
- Application exits if validation fails
- Warnings logged for weak configurations
- Safe environment info logged (no secrets)

### 2. Input Validation ✅
**File**: `src/utils/inputValidator.js`

**Features**:
- Express-validator integration
- Reusable validation rules
- Automatic error handling
- Sanitization utilities
- Custom validators

**Common Rules**:
- Email validation with normalization
- Password strength (min 8 chars, uppercase, lowercase, number)
- Phone number format
- Name validation (letters, spaces, hyphens only)
- Amount validation (positive numbers)
- Date validation (ISO 8601)
- Status validation (predefined values)
- Role validation (ADMIN, VENDOR, RETAILER)

**Validation Rule Sets**:
- `register`: Email, password, name, phone, role
- `login`: Email, password
- `createOrder`: Retailer ID, items array, payment method
- `updateOrderStatus`: ID, status, notes
- `createProduct`: Name, category, unit, price
- `recordPayment`: Order ID, amount, payment method
- `pagination`: Page, limit, sort parameters

**Usage Example**:
```javascript
const { validationRules } = require('../utils/inputValidator');

router.post('/orders', 
  validationRules.createOrder,
  orderController.createOrder
);
```

### 3. Rate Limiting ✅
**File**: `src/middleware/security.js`

**Rate Limiters**:

**API Limiter** (General):
- Window: 15 minutes
- Max requests: 100
- Applied to all `/api` routes

**Auth Limiter** (Strict):
- Window: 15 minutes
- Max attempts: 5
- Skips successful requests
- Applied to login/register endpoints

**Webhook Limiter**:
- Window: 1 minute
- Max requests: 100
- Applied to webhook endpoints

**Admin Limiter**:
- Window: 1 minute
- Max requests: 30
- Applied to admin action endpoints

**Features**:
- Standard headers (RateLimit-*)
- Custom error messages
- IP-based tracking
- Automatic logging of violations

### 4. Role-Based Access Control (RBAC) ✅
**File**: `src/middleware/auth.js`

**Features**:
- JWT token authentication
- User active status check
- User approval status check (vendors/retailers)
- Role-based authorization
- Resource ownership verification
- Optional authentication
- Comprehensive logging

**Functions**:

**authenticate**:
- Verifies JWT token
- Checks user exists and is active
- Checks user is approved (for vendors/retailers)
- Attaches user to request
- Logs authentication attempts

**authorize(...roles)**:
- Checks user has required role
- Logs authorization failures
- Returns 403 for insufficient permissions

**authorizeOwner(resourceIdParam, resourceType)**:
- Checks user owns the resource
- Admins can access any resource
- Supports: user, order, retailer, vendor resources

**optionalAuth**:
- Doesn't fail if no token provided
- Attaches user if valid token

**Usage Example**:
```javascript
const { authenticate, authorize, authorizeOwner } = require('../middleware/auth');

// Admin only
router.get('/admin/users', 
  authenticate, 
  authorize('ADMIN'), 
  adminController.listUsers
);

// Vendor or Admin
router.get('/vendor/orders', 
  authenticate, 
  authorize('VENDOR', 'ADMIN'), 
  vendorController.listOrders
);

// Resource owner or Admin
router.get('/orders/:id', 
  authenticate, 
  authorizeOwner('id', 'order'), 
  orderController.getOrder
);
```

### 5. Admin Action Logging ✅
**File**: `src/middleware/adminLogger.js`

**Features**:
- Logs all admin actions to `audit_logs` table
- Captures request and response details
- Sanitizes sensitive data
- Automatic entity detection
- IP address and user agent tracking

**Logged Information**:
- User ID and details
- Action type (CREATE, UPDATE, DELETE, APPROVE, etc.)
- Entity type and ID
- Request method, path, query, body
- Response status code
- IP address and user agent
- Timestamp

**Action Types**:
- CREATE, UPDATE, DELETE (from HTTP methods)
- APPROVE, REJECT, SUSPEND, ACTIVATE
- OVERRIDE, EXPORT, TRIGGER, CLEANUP

**Entity Types**:
- USER, ORDER, PRODUCT, RETAILER, VENDOR
- PAYMENT, CREDIT, RISK_CONTROL
- ORDER_ROUTING, RECOVERY, JOB_QUEUE

**Usage**:
```javascript
const { logAdminAction } = require('../middleware/adminLogger');

// Apply to all admin routes
router.use('/admin', authenticate, authorize('ADMIN'), logAdminAction);
```

**Query Logs**:
```javascript
const { getAdminActionLogs, getAdminActionStats } = require('../middleware/adminLogger');

// Get logs with filters
const logs = await getAdminActionLogs({
  userId: 1,
  action: 'DELETE',
  entityType: 'ORDER',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
}, {
  page: 1,
  limit: 50,
});

// Get statistics
const stats = await getAdminActionStats('2026-01-01', '2026-12-31');
```

### 6. Webhook Verification ✅
**File**: `src/middleware/security.js`

**WhatsApp Webhook Verification**:
- GET request: Verifies hub.mode and hub.verify_token
- POST request: Verifies X-Hub-Signature-256 header
- HMAC SHA256 signature validation
- Automatic logging of verification attempts

**Generic Webhook Verification**:
- Verifies X-Webhook-Signature header
- HMAC SHA256 signature validation
- Configurable secret per webhook

**Usage**:
```javascript
const { verifyWhatsAppWebhook, verifyWebhookSignature } = require('../middleware/security');

// WhatsApp webhook
router.post('/whatsapp/webhook', 
  verifyWhatsAppWebhook, 
  whatsappController.webhook
);

// Generic webhook
router.post('/payment/webhook', 
  verifyWebhookSignature(process.env.PAYMENT_WEBHOOK_SECRET), 
  paymentController.webhook
);
```

### 7. Secure Error Handling ✅
**File**: `src/middleware/errorHandler.js`

**Features**:
- Hides internal errors in production
- Generic error messages for 500 errors
- Sanitizes database errors
- Generates error IDs for support reference
- Comprehensive error logging
- Sanitizes sensitive data in logs

**Production Behavior**:
- 500 errors: "An unexpected error occurred"
- Database errors: "A database error occurred"
- Returns error ID for support reference
- No stack traces exposed

**Development Behavior**:
- Full error details
- Stack traces included
- Error codes and names

**Error Types Handled**:
- Prisma errors (P2002, P2025, P2003, P2014)
- Validation errors
- JWT errors (JsonWebTokenError, TokenExpiredError)
- Multer errors (file upload)
- Syntax errors (invalid JSON)

**Usage**:
```javascript
// Async error wrapper
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/orders', asyncHandler(async (req, res) => {
  const orders = await orderService.getOrders();
  res.json({ success: true, data: orders });
}));
```

### 8. Security Headers ✅
**File**: `src/middleware/security.js`

**Headers Applied**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`
- `Content-Security-Policy` (production only)
- Removes `X-Powered-By` header

**Content Security Policy** (Production):
```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
```

### 9. Request Sanitization ✅
**File**: `src/middleware/security.js`

**Features**:
- Removes dangerous keys (starting with $ or _)
- Removes null bytes
- Removes control characters
- Recursive object sanitization
- Applied to body, query, and params

**Protection Against**:
- NoSQL injection
- Command injection
- Path traversal
- Null byte injection

### 10. CORS Configuration ✅
**File**: `src/middleware/security.js`

**Production CORS**:
- Origin whitelist from `ALLOWED_ORIGINS` env variable
- Credentials enabled
- Automatic origin validation
- Logs blocked origins

**Development CORS**:
- Allows all origins
- Credentials enabled

**Configuration**:
```env
ALLOWED_ORIGINS=https://app.khaacho.com,https://admin.khaacho.com
```

## Security Checklist

### Environment Setup
- [ ] Set strong `JWT_SECRET` (min 64 characters)
- [ ] Set strong `WHATSAPP_VERIFY_TOKEN` (min 32 characters)
- [ ] Configure `ALLOWED_ORIGINS` for production
- [ ] Set `NODE_ENV=production`
- [ ] Use strong database password
- [ ] Configure Redis password (if exposed)

### Application Security
- [ ] All routes have authentication
- [ ] All routes have authorization
- [ ] All inputs are validated
- [ ] All admin actions are logged
- [ ] Rate limiting is enabled
- [ ] CORS is configured
- [ ] Security headers are applied
- [ ] Error messages are sanitized

### Monitoring
- [ ] Monitor rate limit violations
- [ ] Monitor authentication failures
- [ ] Monitor authorization failures
- [ ] Review admin action logs regularly
- [ ] Monitor webhook verification failures

## Testing Security

### Test Environment Validation
```bash
# Missing required variable
unset JWT_SECRET
npm start
# Should exit with validation error

# Weak JWT secret
export JWT_SECRET="weak"
npm start
# Should show warning or error
```

### Test Rate Limiting
```bash
# Exceed rate limit
for i in {1..150}; do
  curl http://localhost:3000/api/v1/health
done
# Should return 429 after 100 requests
```

### Test Authentication
```bash
# No token
curl http://localhost:3000/api/v1/orders
# Should return 401

# Invalid token
curl http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer invalid"
# Should return 401

# Valid token
curl http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer VALID_TOKEN"
# Should return 200
```

### Test Authorization
```bash
# Retailer accessing admin endpoint
curl http://localhost:3000/api/v1/admin/users \
  -H "Authorization: Bearer RETAILER_TOKEN"
# Should return 403
```

### Test Input Validation
```bash
# Invalid email
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"Test123"}'
# Should return 400 with validation errors
```

### Test Error Handling
```bash
# In production, internal errors should be hidden
export NODE_ENV=production
# Trigger an error
curl http://localhost:3000/api/v1/orders/99999
# Should return generic error message, not stack trace
```

## Security Best Practices

### 1. Authentication
- Always use `authenticate` middleware
- Check user is active and approved
- Use strong JWT secrets
- Set appropriate token expiration

### 2. Authorization
- Always use `authorize` middleware after `authenticate`
- Use `authorizeOwner` for resource-specific access
- Log all authorization failures
- Implement principle of least privilege

### 3. Input Validation
- Validate all inputs
- Use predefined validation rules
- Sanitize user input
- Reject invalid data early

### 4. Rate Limiting
- Apply appropriate limits per endpoint type
- Use stricter limits for auth endpoints
- Monitor rate limit violations
- Consider IP whitelisting for webhooks

### 5. Error Handling
- Never expose internal errors in production
- Log all errors with full details
- Provide error IDs for support
- Sanitize error messages

### 6. Logging
- Log all admin actions
- Log authentication/authorization failures
- Log rate limit violations
- Log webhook verification failures
- Never log sensitive data (passwords, tokens)

### 7. Webhooks
- Always verify webhook signatures
- Use strong verification tokens
- Rate limit webhook endpoints
- Store events before processing

## Troubleshooting

### Environment Validation Fails
- Check all required variables are set
- Verify variable formats (URLs, etc.)
- Check for weak secrets in production
- Review validation error messages

### Rate Limit Issues
- Check if legitimate traffic is being blocked
- Adjust limits in configuration
- Consider IP whitelisting
- Review rate limit logs

### Authentication Failures
- Verify JWT secret is correct
- Check token expiration
- Verify user is active and approved
- Check token format (Bearer prefix)

### Authorization Failures
- Verify user has correct role
- Check resource ownership
- Review authorization logs
- Verify middleware order

### Admin Logs Not Created
- Check user is authenticated as ADMIN
- Verify audit_logs table exists
- Check database permissions
- Review error logs

## Configuration Reference

### Environment Variables
```env
# Security
NODE_ENV=production
JWT_SECRET=<64-character-random-string>
WHATSAPP_VERIFY_TOKEN=<32-character-random-string>
ALLOWED_ORIGINS=https://app.khaacho.com,https://admin.khaacho.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### Rate Limit Configuration
```javascript
// In src/middleware/security.js
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // requests per window
});
```

## Summary

The production security layer provides:

✅ **Environment Validation**: Ensures all required configuration is present and secure
✅ **Input Validation**: Validates and sanitizes all user input
✅ **Rate Limiting**: Prevents abuse with configurable limits
✅ **RBAC**: Strict role-based access control with logging
✅ **Admin Logging**: Complete audit trail of admin actions
✅ **Webhook Security**: Signature verification for webhooks
✅ **Error Handling**: Hides internal errors in production
✅ **Security Headers**: Comprehensive security headers
✅ **Request Sanitization**: Prevents injection attacks
✅ **CORS**: Production-ready CORS configuration

**Result**: Production-ready security with defense in depth.
