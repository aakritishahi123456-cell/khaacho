# Price Intelligence Module - API Documentation

## Overview

The Price Intelligence Module provides comprehensive market price analysis, historical tracking, abnormal price detection, and intelligent vendor recommendations for order routing.

## Base URL

```
/api/v1/price-intelligence
```

## Authentication

All endpoints require authentication via JWT token:

```
Authorization: Bearer <token>
```

---

## Core Features

### 1. Historical Price Tracking
- Automatic tracking of all price changes
- Complete audit trail per vendor per product
- Market average calculation
- Price deviation analysis

### 2. Market Analytics
- Real-time market average, min, max prices
- Price volatility scoring (0-100)
- Trend analysis (INCREASING, DECREASING, STABLE)
- Vendor distribution analysis

### 3. Abnormal Price Detection
- Automatic alerts for price changes > 20%
- Severity levels: LOW, MEDIUM, HIGH, CRITICAL
- Alert acknowledgement system
- Expiration management

### 4. Routing Integration
- Best price vendor recommendation
- Price score calculation for routing
- Market-based vendor selection

---

## API Endpoints

### 1. Get Price Intelligence Dashboard

Get comprehensive dashboard with market overview, alerts, and volatile products.

**Endpoint**: `GET /api/v1/price-intelligence/dashboard`

**Access**: Admin, Operator

**Response**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_products": 150,
      "avg_volatility": 35.5,
      "highly_volatile_count": 12,
      "volatile_count": 25,
      "increasing_trend_count": 45,
      "decreasing_trend_count": 30,
      "avg_price_change_30d": 2.5
    },
    "alerts": {
      "total_alerts": 15,
      "critical_alerts": 3,
      "high_alerts": 5,
      "abnormal_increase_count": 8,
      "abnormal_decrease_count": 7,
      "recent": [...]
    },
    "volatileProducts": [...],
    "biggestChanges": [...]
  }
}
```

---

### 2. Get Product Price History

Get historical price changes for a product.

**Endpoint**: `GET /api/v1/price-intelligence/products/:productId/history`

**Access**: Admin, Operator, Vendor

**Query Parameters**:
- `vendorId` (optional): Filter by vendor
- `limit` (optional): Number of records (default: 100)
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/price-intelligence/products/PRODUCT_ID/history?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "product_id": "product-uuid",
        "vendor_id": "vendor-uuid",
        "price": "105.50",
        "previous_price": "100.00",
        "price_change": "5.50",
        "price_change_percent": "5.50",
        "market_avg_price": "102.00",
        "deviation_from_market": "3.43",
        "is_lowest_price": false,
        "is_highest_price": false,
        "change_reason": "price_update",
        "effective_from": "2026-02-07T10:00:00Z",
        "is_current": true,
        "vendor_name": "ABC Distributors",
        "product_name": "Product A"
      }
    ],
    "count": 50
  }
}
```

---

### 3. Get Market Analytics for Product

Get comprehensive market analytics for a specific product.

**Endpoint**: `GET /api/v1/price-intelligence/products/:productId/analytics`

**Access**: Admin, Operator, Vendor

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "product_id": "product-uuid",
    "product_name": "Product A",
    "product_code": "PROD-001",
    "current_avg_price": "102.50",
    "current_min_price": "95.00",
    "current_max_price": "110.00",
    "current_median_price": "101.00",
    "price_range": "15.00",
    "price_range_percent": "14.63",
    "total_vendors": 8,
    "vendors_below_avg": 4,
    "vendors_above_avg": 4,
    "avg_price_30d_ago": "98.00",
    "price_change_30d": "4.50",
    "price_change_30d_percent": "4.59",
    "price_volatility_score": "45.50",
    "price_stability_rating": "MODERATE",
    "price_trend": "INCREASING",
    "trend_strength": "45.90",
    "lowest_price_vendor_id": "vendor-uuid",
    "lowest_price": "95.00",
    "lowest_price_vendor_name": "Best Price Vendor",
    "last_calculated_at": "2026-02-07T10:00:00Z"
  }
}
```

---

### 4. Get All Market Analytics

Get market analytics for all products with filtering and sorting.

**Endpoint**: `GET /api/v1/price-intelligence/analytics`

**Access**: Admin, Operator

**Query Parameters**:
- `sortBy` (optional): Field to sort by (default: `price_volatility_score`)
  - Options: `price_volatility_score`, `current_avg_price`, `price_change_30d_percent`, `price_range_percent`, `trend_strength`
- `sortOrder` (optional): `ASC` or `DESC` (default: `DESC`)
- `volatilityRating` (optional): Filter by rating (`STABLE`, `MODERATE`, `VOLATILE`, `HIGHLY_VOLATILE`)
- `trend` (optional): Filter by trend (`INCREASING`, `DECREASING`, `STABLE`, `FLUCTUATING`)
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/price-intelligence/analytics?volatilityRating=VOLATILE&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 5. Get Price Alerts

Get price alerts with filtering options.

**Endpoint**: `GET /api/v1/price-intelligence/alerts`

**Access**: Admin, Operator

**Query Parameters**:
- `productId` (optional): Filter by product
- `vendorId` (optional): Filter by vendor
- `alertType` (optional): `abnormal_increase`, `abnormal_decrease`, `high_volatility`, `market_shift`
- `severity` (optional): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `isAcknowledged` (optional): `true` or `false` (default: `false`)
- `limit` (optional): Number of alerts (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/price-intelligence/alerts?severity=CRITICAL&isAcknowledged=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-uuid",
        "alert_type": "abnormal_increase",
        "severity": "CRITICAL",
        "product_id": "product-uuid",
        "vendor_id": "vendor-uuid",
        "title": "Abnormal Price Increase",
        "description": "Price changed by 55.00% from 100.00 to 155.00",
        "old_price": "100.00",
        "new_price": "155.00",
        "price_change_percent": "55.00",
        "market_avg_price": "102.00",
        "threshold_exceeded": "55.00",
        "is_acknowledged": false,
        "created_at": "2026-02-07T10:00:00Z",
        "expires_at": "2026-02-14T10:00:00Z",
        "product_name": "Product A",
        "vendor_name": "ABC Distributors"
      }
    ],
    "count": 15
  }
}
```

---

### 6. Acknowledge Price Alert

Mark a price alert as acknowledged.

**Endpoint**: `POST /api/v1/price-intelligence/alerts/:alertId/acknowledge`

**Access**: Admin, Operator

**Request Body**:
```json
{
  "notes": "Contacted vendor, price increase due to supplier cost increase"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Price alert acknowledged successfully"
}
```

---

### 7. Get Lowest Price Vendor

Get the vendor with the lowest price for a product.

**Endpoint**: `GET /api/v1/price-intelligence/products/:productId/lowest-price-vendor`

**Access**: Admin, Operator

**Response**:
```json
{
  "success": true,
  "data": {
    "vendor_id": "vendor-uuid",
    "vendor_price": "95.00",
    "vendor_code": "VEND-001",
    "vendor_name": "Best Price Vendor",
    "city": "Surkhet",
    "market_avg": "102.50",
    "deviation_from_avg": "-7.32"
  }
}
```

---

### 8. Get Price Comparison

Compare prices across all vendors for a product.

**Endpoint**: `GET /api/v1/price-intelligence/products/:productId/comparison`

**Access**: Admin, Operator

**Response**:
```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "vendor_id": "vendor-uuid",
        "vendor_price": "95.00",
        "vendor_code": "VEND-001",
        "vendor_name": "Best Price Vendor",
        "city": "Surkhet",
        "stock": 100,
        "is_available": true,
        "market_avg": "102.50",
        "market_min": "95.00",
        "market_max": "110.00",
        "deviation_from_avg": "-7.32",
        "is_lowest_price": true,
        "price_rating": "EXCELLENT"
      }
    ],
    "count": 8
  }
}
```

**Price Ratings**:
- `EXCELLENT`: ≤ 5% above market average
- `GOOD`: 5-10% above market average
- `FAIR`: 10-15% above market average
- `EXPENSIVE`: > 15% above market average

---

### 9. Get Price Trends

Get historical price trends for a product.

**Endpoint**: `GET /api/v1/price-intelligence/products/:productId/trends`

**Access**: Admin, Operator, Vendor

**Query Parameters**:
- `days` (optional): Number of days (default: 30)

**Response**:
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "date": "2026-02-01",
        "avg_price": "100.50",
        "min_price": "95.00",
        "max_price": "105.00",
        "vendors_count": 8,
        "market_avg": "100.50"
      }
    ],
    "count": 30,
    "period": "30 days"
  }
}
```

---

### 10. Get Volatile Products

Get products with high price volatility.

**Endpoint**: `GET /api/v1/price-intelligence/volatile-products`

**Access**: Admin, Operator

**Query Parameters**:
- `threshold` (optional): Volatility score threshold (default: 50)
- `limit` (optional): Number of products (default: 20)

**Response**:
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": "product-uuid",
        "product_name": "Volatile Product",
        "product_code": "PROD-001",
        "category": "Electronics",
        "price_volatility_score": "85.50",
        "price_stability_rating": "HIGHLY_VOLATILE",
        "current_avg_price": "150.00",
        "price_change_30d_percent": "25.50"
      }
    ],
    "count": 12,
    "threshold": 50
  }
}
```

---

### 11. Calculate Price Volatility

Calculate volatility score for a product.

**Endpoint**: `GET /api/v1/price-intelligence/products/:productId/volatility`

**Access**: Admin, Operator

**Query Parameters**:
- `days` (optional): Period in days (default: 30)

**Response**:
```json
{
  "success": true,
  "data": {
    "volatilityScore": 45.5,
    "rating": "MODERATE",
    "period": "30 days"
  }
}
```

**Volatility Ratings**:
- `STABLE`: 0-24
- `MODERATE`: 25-49
- `VOLATILE`: 50-74
- `HIGHLY_VOLATILE`: 75-100

---

### 12. Update Market Analytics

Manually trigger market analytics update for a product.

**Endpoint**: `POST /api/v1/price-intelligence/products/:productId/update-analytics`

**Access**: Admin, Operator

**Response**:
```json
{
  "success": true,
  "message": "Market analytics updated successfully"
}
```

---

### 13. Update All Market Analytics

Trigger batch update for all products (admin only).

**Endpoint**: `POST /api/v1/price-intelligence/update-all-analytics`

**Access**: Admin

**Response**:
```json
{
  "success": true,
  "data": {
    "total": 150,
    "successful": 148,
    "failed": 2,
    "results": [...]
  }
}
```

---

## Automatic Features

### 1. Price Change Tracking

**Trigger**: When vendor updates product price in `vendor_products` table

**Actions**:
1. Creates history record with old and new price
2. Calculates price change percentage
3. Compares to market average
4. Detects abnormal changes (> 20%)
5. Creates alerts if threshold exceeded
6. Updates market analytics

### 2. Abnormal Price Detection

**Thresholds**:
- **20-34%**: MEDIUM severity
- **35-49%**: HIGH severity
- **50%+**: CRITICAL severity

**Alert Types**:
- `abnormal_increase`: Price increased significantly
- `abnormal_decrease`: Price decreased significantly

### 3. Market Analytics Calculation

**Includes**:
- Current average, min, max, median prices
- Price range and range percentage
- Vendor distribution (below/above average)
- 30-day price change
- Volatility score (0-100)
- Trend analysis (INCREASING, DECREASING, STABLE)
- Lowest price vendor identification

---

## Background Worker

**Schedule**: Every 4 hours

**Process**:
1. Gets all active products
2. Recalculates market analytics for each
3. Updates volatility scores
4. Identifies trend changes
5. Logs results

**Manual Trigger**: Via API endpoint

---

## Integration with Order Routing

The price intelligence module integrates with order routing to recommend best-price vendors:

1. **During Routing**: System fetches lowest price vendor for each product
2. **Price Score**: Calculated based on deviation from market average
3. **Vendor Selection**: Price is 20% weight in overall routing score
4. **Transparency**: Routing decision includes price comparison data

---

## Database Tables

### product_price_history
- Complete audit trail of price changes
- Links to vendor and product
- Tracks market context at time of change

### market_price_analytics
- Current market state per product
- Volatility and trend metrics
- Lowest price vendor tracking

### price_alerts
- Abnormal price change alerts
- Acknowledgement tracking
- Expiration management

### price_recommendations
- AI-generated price suggestions (future)
- Confidence scoring
- Review workflow

### price_volatility_log
- Historical volatility tracking
- Period-based analysis
- Trend identification

---

## Best Practices

### For Admins

1. **Monitor Dashboard Daily**
   - Check unacknowledged alerts
   - Review volatile products
   - Track market trends

2. **Acknowledge Alerts Promptly**
   - Investigate abnormal changes
   - Contact vendors for clarification
   - Document reasons

3. **Use Price Comparison**
   - Identify overpriced vendors
   - Negotiate better rates
   - Optimize vendor selection

4. **Track Trends**
   - Identify seasonal patterns
   - Anticipate price changes
   - Plan inventory accordingly

### For Vendors

1. **Monitor Your Pricing**
   - Check price history regularly
   - Compare to market average
   - Stay competitive

2. **Avoid Sudden Changes**
   - Gradual price adjustments preferred
   - Communicate major changes in advance
   - Provide justification for increases

3. **Maintain Competitiveness**
   - Stay within 10% of market average
   - Offer best prices for priority products
   - Balance price and quality

---

## Error Responses

Standard error format:

```json
{
  "success": false,
  "message": "Error description"
}
```

**Common Status Codes**:
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## Volatility Score Calculation

```
Volatility Score = MIN(100, (
  (price_changes_count × 2) +
  (avg_change_percent × 3) +
  (max_change_percent × 2) +
  (std_deviation × 2)
))
```

**Factors**:
- Frequency of changes
- Average magnitude of changes
- Maximum single change
- Standard deviation

---

## Use Cases

### 1. Detect Price Manipulation
Monitor for vendors artificially inflating prices during high demand.

### 2. Identify Market Trends
Track overall market direction for procurement planning.

### 3. Optimize Vendor Selection
Route orders to vendors with best price-performance ratio.

### 4. Negotiate Better Rates
Use market data to negotiate with overpriced vendors.

### 5. Forecast Costs
Predict future costs based on historical trends.

### 6. Manage Inventory
Stock up before anticipated price increases.

---

## Future Enhancements

1. **Price Predictions**: ML-based price forecasting
2. **Automated Recommendations**: AI-suggested optimal prices
3. **Competitor Analysis**: External market price tracking
4. **Dynamic Pricing**: Automatic price adjustments
5. **Bulk Price Updates**: Import/export price lists
6. **Price Negotiation**: Automated vendor negotiation workflow

---

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review database triggers and functions
- Verify worker is running
- Check market analytics last update time
