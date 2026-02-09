# Testing Guide for Khaacho Platform

## Manual Testing Workflow

### 1. Setup Test Environment

```bash
# Install dependencies
npm install

# Setup database
npm run db:generate
npm run db:migrate

# Seed test data
npm run db:seed
```

### 2. Test User Credentials

After seeding, use these credentials:

**Admin**
- Phone: +9779800000000
- Password: admin123

**Vendor**
- Phone: +9779800000001
- Password: vendor123

**Retailer**
- Phone: +9779800000002
- Password: retailer123

### 3. API Testing with cURL

#### Authentication

```bash
# Register new retailer
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+9779800000010",
    "password": "test123",
    "name": "Test Retailer",
    "role": "RETAILER",
    "businessName": "Test Shop"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+9779800000002",
    "password": "retailer123"
  }'

# Save the token from response
TOKEN="your-jwt-token-here"
```

#### Order Lifecycle Testing

```bash
# 1. Create draft order (via WhatsApp simulation)
# This would normally come from WhatsApp webhook
# For testing, use the order creation endpoint

# 2. Get all orders
curl -X GET http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN"

# 3. Confirm order (Admin)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/confirm \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Assign vendor (Admin)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/assign-vendor \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "vendor-uuid"
  }'

# 5. Accept order (Vendor)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/accept \
  -H "Authorization: Bearer $VENDOR_TOKEN"

# 6. Dispatch order (Vendor)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/dispatch \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expectedDelivery": "2026-02-10T00:00:00Z"
  }'

# 7. Deliver order (Vendor)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/deliver \
  -H "Authorization: Bearer $VENDOR_TOKEN"

# 8. Complete order (Admin)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/complete \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 9. Get order status history
curl -X GET http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/history \
  -H "Authorization: Bearer $TOKEN"
```

#### Credit & Payment Testing

```bash
# Get credit history
curl -X GET http://localhost:3000/api/v1/credit/history \
  -H "Authorization: Bearer $RETAILER_TOKEN"

# Record payment
curl -X POST http://localhost:3000/api/v1/credit/payment \
  -H "Authorization: Bearer $VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-uuid",
    "amount": 1000,
    "referenceNumber": "PAY123"
  }'

# Get credit score
curl -X GET http://localhost:3000/api/v1/credit/score \
  -H "Authorization: Bearer $RETAILER_TOKEN"
```

#### Dashboard Testing

```bash
# Admin dashboard
curl -X GET http://localhost:3000/api/v1/dashboard/admin?days=30 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Vendor dashboard
curl -X GET http://localhost:3000/api/v1/dashboard/vendor \
  -H "Authorization: Bearer $VENDOR_TOKEN"

# Retailer dashboard
curl -X GET http://localhost:3000/api/v1/dashboard/retailer \
  -H "Authorization: Bearer $RETAILER_TOKEN"
```

#### Analytics Testing

```bash
# Order trends
curl -X GET "http://localhost:3000/api/v1/analytics/order-trends?startDate=2026-01-01&endDate=2026-02-06&groupBy=day" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Product performance
curl -X GET http://localhost:3000/api/v1/analytics/product-performance?limit=20 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Retailer analytics
curl -X GET http://localhost:3000/api/v1/analytics/retailer/{RETAILER_ID} \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Vendor analytics
curl -X GET http://localhost:3000/api/v1/analytics/vendor/{VENDOR_ID} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 4. WhatsApp Integration Testing

#### Simulate Incoming Order

```bash
# Webhook verification
curl -X GET "http://localhost:3000/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=your-verify-token&hub.challenge=test123"

# Simulate incoming message
curl -X POST http://localhost:3000/api/v1/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "+9779800000002",
            "id": "wamid.test123",
            "text": {
              "body": "RICE-1KG x 10\nDAL-1KG x 5"
            }
          }]
        }
      }]
    }]
  }'
```

### 5. Database Verification

```sql
-- Check order status transitions
SELECT * FROM order_status_logs 
WHERE order_id = 'your-order-id' 
ORDER BY created_at;

-- Check credit ledger balance
SELECT * FROM credit_ledgers 
WHERE retailer_id = 'your-retailer-id' 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify stock deduction
SELECT p.name, vp.stock, vp.sku 
FROM vendor_products vp
JOIN products p ON vp.product_id = p.id
WHERE vp.vendor_id = 'your-vendor-id';

-- Check retailer stats
SELECT * FROM retailers 
WHERE id = 'your-retailer-id';
```

### 6. Error Scenarios to Test

#### Invalid State Transitions
```bash
# Try to dispatch a DRAFT order (should fail)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/dispatch \
  -H "Authorization: Bearer $VENDOR_TOKEN"

# Expected: 400 Bad Request
# "Invalid transition from DRAFT to DISPATCHED"
```

#### Insufficient Stock
```bash
# Try to order more than available stock
# Should fail during order creation
```

#### Unauthorized Access
```bash
# Retailer trying to confirm order (should fail)
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/confirm \
  -H "Authorization: Bearer $RETAILER_TOKEN"

# Expected: 403 Forbidden
```

#### Duplicate Order Cancellation
```bash
# Cancel order twice
curl -X POST http://localhost:3000/api/v1/order-lifecycle/{ORDER_ID}/cancel \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test"}'

# Second attempt should fail
# Expected: "Order is already cancelled"
```

### 7. Performance Testing

```bash
# Install Apache Bench
# Test concurrent requests

# 100 requests, 10 concurrent
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/orders

# Monitor response times and error rate
```

### 8. Load Testing Checklist

- [ ] 100 concurrent users browsing products
- [ ] 50 concurrent order creations
- [ ] 20 concurrent payment recordings
- [ ] Dashboard loads under 2 seconds
- [ ] API response time < 500ms for 95th percentile
- [ ] Database connection pool handles load
- [ ] No memory leaks after 1000 requests

### 9. Integration Testing Checklist

- [ ] Order creation triggers credit ledger entry
- [ ] Order cancellation reverses credit
- [ ] Payment updates order status
- [ ] Stock deducted on order acceptance
- [ ] Stock restored on order cancellation
- [ ] WhatsApp notifications sent
- [ ] Audit logs created for all actions
- [ ] Credit score recalculated on completion

### 10. Security Testing

```bash
# Test without authentication
curl -X GET http://localhost:3000/api/v1/orders

# Expected: 401 Unauthorized

# Test with expired token
curl -X GET http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer expired-token"

# Expected: 401 Unauthorized

# Test SQL injection
curl -X GET "http://localhost:3000/api/v1/orders?status='; DROP TABLE orders; --" \
  -H "Authorization: Bearer $TOKEN"

# Should be safely handled by Prisma
```

### 11. Monitoring & Logging

```bash
# Check logs
tail -f logs/combined.log
tail -f logs/error.log

# Check for errors
grep "ERROR" logs/combined.log

# Monitor database connections
# In PostgreSQL:
SELECT count(*) FROM pg_stat_activity;
```

### 12. Backup & Recovery Testing

```bash
# Backup database
pg_dump khaacho > backup.sql

# Simulate data loss
# Restore database
psql khaacho < backup.sql

# Verify data integrity
```

## Automated Testing (Future)

### Unit Tests Structure
```
tests/
  unit/
    services/
      orderLifecycle.service.test.js
      credit.service.test.js
      whatsapp.service.test.js
    utils/
      errors.test.js
      response.test.js
```

### Integration Tests Structure
```
tests/
  integration/
    order-lifecycle.test.js
    payment-flow.test.js
    whatsapp-integration.test.js
```

### Test Coverage Goals
- Unit tests: > 80%
- Integration tests: Critical paths
- E2E tests: Complete order lifecycle

## Production Readiness Checklist

- [ ] All manual tests pass
- [ ] Error scenarios handled gracefully
- [ ] Logging configured properly
- [ ] Database indexes verified
- [ ] Security vulnerabilities checked
- [ ] Performance benchmarks met
- [ ] Backup strategy tested
- [ ] Monitoring alerts configured
- [ ] Documentation complete
- [ ] Deployment tested on staging
