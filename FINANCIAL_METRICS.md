# Financial Metrics System Documentation

## Overview
Automated financial metrics calculation system that tracks retailer behavior based on order and payment history. All metrics are calculated automatically and stored in a dedicated table with triggers ensuring data integrity.

## Metrics Calculated

### Order Metrics
1. **total_orders_last_30_days**: Count of delivered/completed orders in last 30 days
2. **total_orders_lifetime**: Total count of all delivered/completed orders
3. **total_purchase_value**: Sum of all completed order values
4. **average_order_value**: Total purchase value / total orders

### Payment Behavior Metrics
5. **payment_delay_average_days**: Average days between order delivery and first payment
6. **on_time_payment_ratio**: Percentage of payments made within 7 days of delivery
7. **total_payments_made**: Count of all payments
8. **on_time_payments**: Count of payments within 7 days
9. **late_payments**: Count of payments after 7 days

### Credit Metrics
10. **outstanding_credit**: Current debt amount
11. **credit_limit**: Assigned credit limit
12. **credit_utilization_percentage**: (Outstanding / Limit) * 100
13. **available_credit**: Credit limit - outstanding credit

### Frequency Metrics
14. **order_frequency_per_week**: (Total orders / days since first order) * 7
15. **days_since_first_order**: Days since first completed order
16. **days_since_last_order**: Days since last completed order

## Automatic Updates

### Triggers
Metrics are automatically recalculated when:
1. **Order status changes** to DELIVERED or COMPLETED
2. **Payment is recorded** (INSERT or UPDATE on payments table)
3. **Retailer credit limit changes**
4. **Outstanding debt changes**

### Calculation Function
```sql
SELECT calculate_retailer_financial_metrics('retailer-uuid');
```

This function:
- Queries order history
- Analyzes payment patterns
- Calculates all metrics
- Updates or inserts into retailer_financial_metrics table

## Data Integrity

### No Manual Editing
- Manual UPDATE operations are blocked by trigger
- Only the calculation function can update metrics
- Ensures all metrics are reproducible from source data

### Reproducibility
All metrics can be verified:
```sql
-- Recalculate and compare
SELECT * FROM retailer_financial_metrics WHERE retailer_id = 'uuid';
SELECT calculate_retailer_financial_metrics('uuid');
SELECT * FROM retailer_financial_metrics WHERE retailer_id = 'uuid';
```

## API Endpoints

### Get Retailer Metrics
```http
GET /api/v1/financial-metrics/retailer/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "retailerId": "uuid",
    "totalOrdersLast30Days": 15,
    "totalOrdersLifetime": 45,
    "totalPurchaseValue": 125000.00,
    "averageOrderValue": 2777.78,
    "paymentDelayAverageDays": 3.5,
    "onTimePaymentRatio": 85.5,
    "outstandingCredit": 25000.00,
    "creditLimit": 50000.00,
    "creditUtilizationPercentage": 50.00,
    "orderFrequencyPerWeek": 2.5,
    "lastCalculatedAt": "2026-02-06T10:30:00Z"
  }
}
```

### Recalculate Metrics
```http
POST /api/v1/financial-metrics/retailer/:id/recalculate
Authorization: Bearer <admin_token>
```

### Get High Credit Utilization Retailers
```http
GET /api/v1/financial-metrics/high-credit-utilization?threshold=80&limit=50
Authorization: Bearer <admin_token>
```

### Get Poor Payment Behavior
```http
GET /api/v1/financial-metrics/poor-payment-behavior?threshold=50&limit=50
Authorization: Bearer <admin_token>
```

### Get Risk Retailers
```http
GET /api/v1/financial-metrics/risk-retailers?limit=50
Authorization: Bearer <admin_token>
```

Risk score = (credit_utilization * 0.6) + ((100 - on_time_ratio) * 0.4)

### Get Metrics Summary
```http
GET /api/v1/financial-metrics/summary
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRetailers": 1500,
    "avgCreditUtilization": 45.5,
    "avgOnTimeRatio": 78.3,
    "avgOrderFrequency": 1.8,
    "avgOrderValue": 2500.00,
    "totalOutstanding": 5000000.00,
    "highUtilizationCount": 120,
    "poorPaymentCount": 85
  }
}
```

### Verify Metrics Accuracy
```http
GET /api/v1/financial-metrics/retailer/:id/verify
Authorization: Bearer <admin_token>
```

Recalculates metrics and compares with stored values.

### Export Metrics
```http
GET /api/v1/financial-metrics/export?minCreditUtilization=70&maxOnTimeRatio=60
Authorization: Bearer <admin_token>
```

### Batch Recalculation (Admin Only)
```http
POST /api/v1/financial-metrics/recalculate-all
Authorization: Bearer <admin_token>
```

Recalculates metrics for all retailers. Use with caution.

## Use Cases

### 1. Credit Limit Adjustment
```javascript
const metrics = await FinancialMetricsService.getRetailerMetrics(retailerId);

if (metrics.onTimePaymentRatio > 90 && 
    metrics.creditUtilizationPercentage < 50 &&
    metrics.orderFrequencyPerWeek > 2) {
  // Consider increasing credit limit
  await increaseCredit Limit(retailerId, newLimit);
}
```

### 2. Risk Assessment
```javascript
const riskRetailers = await FinancialMetricsService.getRiskRetailers(100);

riskRetailers.forEach(retailer => {
  if (retailer.riskScore > 70) {
    // Send warning notification
    // Reduce credit limit
    // Flag for manual review
  }
});
```

### 3. Performance Monitoring
```javascript
const summary = await FinancialMetricsService.getMetricsSummary();

console.log(`Average on-time payment: ${summary.avgOnTimeRatio}%`);
console.log(`High utilization retailers: ${summary.highUtilizationCount}`);
```

### 4. Retailer Segmentation
```javascript
// High-value, reliable customers
const topRetailers = await FinancialMetricsService.getTopRetailersByFrequency(50);

// Need attention
const poorPayment = await FinancialMetricsService.getPoorPaymentBehaviorRetailers(60, 50);

// Credit risk
const highUtilization = await FinancialMetricsService.getHighCreditUtilizationRetailers(85, 50);
```

## Database Schema

```sql
CREATE TABLE retailer_financial_metrics (
    id UUID PRIMARY KEY,
    retailer_id UUID UNIQUE NOT NULL,
    
    -- Order metrics
    total_orders_last_30_days INT DEFAULT 0,
    total_orders_lifetime INT DEFAULT 0,
    total_purchase_value DECIMAL(15,2) DEFAULT 0,
    average_order_value DECIMAL(15,2) DEFAULT 0,
    
    -- Payment behavior
    payment_delay_average_days DECIMAL(8,2) DEFAULT 0,
    on_time_payment_ratio DECIMAL(5,2) DEFAULT 0,
    total_payments_made INT DEFAULT 0,
    on_time_payments INT DEFAULT 0,
    late_payments INT DEFAULT 0,
    
    -- Credit metrics
    outstanding_credit DECIMAL(15,2) DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    credit_utilization_percentage DECIMAL(5,2) DEFAULT 0,
    available_credit DECIMAL(15,2) DEFAULT 0,
    
    -- Frequency metrics
    order_frequency_per_week DECIMAL(8,2) DEFAULT 0,
    days_since_first_order INT DEFAULT 0,
    days_since_last_order INT,
    
    -- Timestamps
    last_calculated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Performance Considerations

### Indexes
- `retailer_id` (unique)
- `credit_utilization_percentage` (DESC)
- `on_time_payment_ratio` (DESC)
- `last_calculated_at`

### Calculation Frequency
- Triggered automatically on relevant events
- Typically < 100ms per retailer
- Batch recalculation: ~1-2 seconds per 100 retailers

### Optimization
- Metrics stored in dedicated table (no joins needed)
- Indexed for fast queries
- Calculation function optimized with CTEs
- Batch operations use parallel processing

## Monitoring

### Check Last Calculation Time
```sql
SELECT 
    retailer_id,
    last_calculated_at,
    EXTRACT(HOURS FROM (NOW() - last_calculated_at)) as hours_since_update
FROM retailer_financial_metrics
WHERE last_calculated_at < NOW() - INTERVAL '24 hours';
```

### Verify Data Integrity
```sql
-- Check for negative values
SELECT * FROM retailer_financial_metrics
WHERE outstanding_credit < 0 
OR credit_utilization_percentage < 0
OR on_time_payment_ratio < 0;

-- Check for impossible values
SELECT * FROM retailer_financial_metrics
WHERE credit_utilization_percentage > 100
OR on_time_payment_ratio > 100;
```

### Performance Monitoring
```sql
-- Average calculation time
SELECT AVG(EXTRACT(MILLISECONDS FROM (updated_at - last_calculated_at)))
FROM retailer_financial_metrics
WHERE updated_at > NOW() - INTERVAL '1 hour';
```

## Troubleshooting

### Metrics Not Updating
1. Check if triggers are enabled:
```sql
SELECT * FROM pg_trigger WHERE tgname LIKE '%metrics%';
```

2. Check for errors in logs
3. Manually recalculate:
```sql
SELECT calculate_retailer_financial_metrics('retailer-uuid');
```

### Incorrect Values
1. Verify source data (orders, payments)
2. Run verification:
```http
GET /api/v1/financial-metrics/retailer/:id/verify
```
3. Check calculation logic in function

### Performance Issues
1. Check index usage:
```sql
EXPLAIN ANALYZE 
SELECT * FROM retailer_financial_metrics 
WHERE credit_utilization_percentage > 80;
```

2. Monitor trigger execution time
3. Consider batch updates during off-peak hours

## Future Enhancements

1. **Historical Tracking**: Store metrics snapshots for trend analysis
2. **Predictive Analytics**: ML models for credit risk prediction
3. **Real-time Alerts**: Notify when metrics cross thresholds
4. **Custom Metrics**: Allow configuration of business-specific metrics
5. **Comparative Analysis**: Benchmark against industry averages
