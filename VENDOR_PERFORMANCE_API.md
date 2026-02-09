# Vendor Performance Tracking API

## Overview

The Vendor Performance Tracking system monitors and evaluates vendor performance based on multiple metrics, calculates reliability scores, and provides comprehensive dashboards for admin oversight.

## Base URL

```
/api/v1/vendor-performance
```

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Core Metrics Tracked

### 1. Order Acceptance Rate (%)
- **Formula**: (Orders Accepted / Total Orders Assigned) × 100
- **Weight in Reliability Score**: 25%
- **Impact**: Higher acceptance rate = better routing priority

### 2. Delivery Completion Rate (%)
- **Formula**: (Orders Completed / Orders Accepted) × 100
- **Weight in Reliability Score**: 30%
- **Impact**: Higher completion rate = higher reliability

### 3. Average Fulfillment Time (hours)
- **Measurement**: Time from order assignment to delivery
- **Weight in Reliability Score**: 20%
- **Ideal**: ≤ 24 hours
- **Acceptable**: ≤ 72 hours
- **Impact**: Faster fulfillment = better score

### 4. Cancellation Rate (%)
- **Formula**: (Orders Cancelled / Total Orders Assigned) × 100
- **Weight in Reliability Score**: 15%
- **Impact**: Lower cancellation rate = better score

### 5. Price Competitiveness Index (0-100)
- **Calculation**: Based on deviation from market average
  - 10%+ below average: 100 points
  - 5-10% below: 90 points
  - Within 5%: 80 points
  - 5-10% above: 70 points
  - 10%+ above: 60 points
- **Weight in Reliability Score**: 10%
- **Impact**: More competitive pricing = better score

### 6. Reliability Score (0-100)
- **Formula**: Weighted average of all metrics
- **Grading Scale**:
  - 90-100: A+ (Excellent)
  - 80-89: A (Very Good)
  - 70-79: B (Good)
  - 60-69: C (Fair)
  - 50-59: D (Poor)
  - 0-49: F (Very Poor)
- **Impact**: Directly affects order routing priority

---

## API Endpoints

### 1. Get All Vendors Performance

Get performance metrics for all vendors (admin dashboard).

**Endpoint**: `GET /api/v1/vendor-performance`

**Access**: Admin, Operator

**Query Parameters**:
- `period` (optional): `all_time` (default), `last_30_days`, `last_90_days`
- `sortBy` (optional): `reliability_score` (default), `acceptance_rate`, `completion_rate`, `avg_fulfillment_time`, `cancellation_rate`, `price_competitiveness_index`
- `sortOrder` (optional): `DESC` (default), `ASC`
- `limit` (optional): Number of results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance?sortBy=reliability_score&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "performances": [
      {
        "id": "uuid",
        "vendor_id": "vendor-uuid",
        "vendor_name": "ABC Distributors",
        "business_name": "ABC Distributors Pvt Ltd",
        "city": "Surkhet",
        "vendor_rating": "4.50",
        "total_orders_assigned": 150,
        "orders_accepted": 145,
        "orders_rejected": 5,
        "orders_completed": 140,
        "orders_cancelled": 3,
        "acceptance_rate": "96.67",
        "completion_rate": "96.55",
        "avg_fulfillment_time": "28.50",
        "cancellation_rate": "2.00",
        "price_competitiveness_index": "85.00",
        "reliability_score": "92.45",
        "last_calculated_at": "2026-02-07T10:00:00Z"
      }
    ],
    "count": 20,
    "limit": 20,
    "offset": 0
  },
  "message": "Vendors performance retrieved successfully"
}
```

---

### 2. Get Specific Vendor Performance

Get performance metrics for a specific vendor.

**Endpoint**: `GET /api/v1/vendor-performance/:vendorId`

**Access**: Admin, Operator, Vendor (own data only)

**Query Parameters**:
- `period` (optional): `all_time` (default), `last_30_days`, `last_90_days`

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance/vendor-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "vendor_id": "vendor-uuid",
    "total_orders_assigned": 150,
    "orders_accepted": 145,
    "orders_rejected": 5,
    "orders_completed": 140,
    "orders_cancelled": 3,
    "acceptance_rate": "96.67",
    "completion_rate": "96.55",
    "avg_fulfillment_time": "28.50",
    "cancellation_rate": "2.00",
    "price_competitiveness_index": "85.00",
    "reliability_score": "92.45",
    "quality_rating": "4.50",
    "customer_complaints": 2,
    "avg_response_time": "1.25",
    "on_time_deliveries": 135,
    "late_deliveries": 5,
    "total_revenue": "2500000.00",
    "avg_order_value": "16666.67",
    "last_calculated_at": "2026-02-07T10:00:00Z",
    "calculation_period": "all_time"
  },
  "message": "Vendor performance retrieved successfully"
}
```

---

### 3. Get Vendor Performance Dashboard

Get comprehensive dashboard data for a vendor including performance, history, events, and pricing.

**Endpoint**: `GET /api/v1/vendor-performance/:vendorId/dashboard`

**Access**: Admin, Operator, Vendor (own data only)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance/vendor-uuid/dashboard" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "vendor": {
      "id": "vendor-uuid",
      "name": "John Doe",
      "businessName": "ABC Distributors",
      "city": "Surkhet",
      "phoneNumber": "+977-9800000000",
      "email": "vendor@example.com",
      "rating": "4.50"
    },
    "performance": {
      "acceptance_rate": "96.67",
      "completion_rate": "96.55",
      "avg_fulfillment_time": "28.50",
      "cancellation_rate": "2.00",
      "price_competitiveness_index": "85.00",
      "reliability_score": "92.45",
      "grade": {
        "grade": "A+",
        "label": "Excellent",
        "color": "#10b981"
      },
      "pendingOrders": 3
    },
    "history": [
      {
        "period_start": "2025-08-01",
        "period_end": "2025-08-31",
        "acceptance_rate": "95.00",
        "completion_rate": "94.00",
        "reliability_score": "90.50"
      }
    ],
    "recentEvents": [
      {
        "id": "event-uuid",
        "event_type": "order_completed",
        "order_number": "ORD-2026-001",
        "created_at": "2026-02-07T09:30:00Z"
      }
    ],
    "priceCompetitiveness": {
      "products": [
        {
          "product_name": "Product A",
          "vendor_price": "100.00",
          "market_avg_price": "105.00",
          "price_deviation": "-4.76",
          "is_competitive": true
        }
      ],
      "averageDeviation": -2.5,
      "competitiveCount": 45,
      "totalProducts": 50
    }
  },
  "message": "Vendor dashboard retrieved successfully"
}
```

---

### 4. Get Vendor Performance History

Get historical performance trends for a vendor.

**Endpoint**: `GET /api/v1/vendor-performance/:vendorId/history`

**Access**: Admin, Operator, Vendor (own data only)

**Query Parameters**:
- `periodType` (optional): `monthly` (default), `weekly`, `daily`, `quarterly`
- `startDate` (optional): Start date (YYYY-MM-DD)
- `endDate` (optional): End date (YYYY-MM-DD)
- `limit` (optional): Number of periods (default: 12)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance/vendor-uuid/history?periodType=monthly&limit=6" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "vendor_id": "vendor-uuid",
        "acceptance_rate": "95.00",
        "completion_rate": "94.00",
        "avg_fulfillment_time": "30.00",
        "cancellation_rate": "3.00",
        "price_competitiveness_index": "82.00",
        "reliability_score": "90.50",
        "period_start": "2025-08-01",
        "period_end": "2025-08-31",
        "period_type": "monthly",
        "created_at": "2025-09-01T00:00:00Z"
      }
    ],
    "count": 6
  },
  "message": "Vendor performance history retrieved successfully"
}
```

---

### 5. Get Vendor Performance Events

Get detailed log of events affecting vendor performance.

**Endpoint**: `GET /api/v1/vendor-performance/:vendorId/events`

**Access**: Admin, Operator, Vendor (own data only)

**Query Parameters**:
- `eventType` (optional): Filter by event type (`order_assigned`, `order_accepted`, `order_rejected`, `order_completed`, `order_cancelled`, `delivery_late`, `delivery_on_time`)
- `limit` (optional): Number of events (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance/vendor-uuid/events?eventType=order_completed&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event-uuid",
        "vendor_id": "vendor-uuid",
        "order_id": "order-uuid",
        "order_number": "ORD-2026-001",
        "event_type": "order_completed",
        "event_data": {
          "fulfillment_time_hours": 26.5
        },
        "affects_acceptance": false,
        "affects_completion": true,
        "affects_fulfillment_time": true,
        "affects_cancellation": false,
        "created_at": "2026-02-07T09:30:00Z"
      }
    ],
    "count": 20
  },
  "message": "Vendor performance events retrieved successfully"
}
```

---

### 6. Get Vendor Price Competitiveness

Get pricing comparison data for a vendor's products.

**Endpoint**: `GET /api/v1/vendor-performance/:vendorId/pricing`

**Access**: Admin, Operator, Vendor (own data only)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance/vendor-uuid/pricing" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "pricing": [
      {
        "id": "uuid",
        "product_id": "product-uuid",
        "product_name": "Product A",
        "product_code": "PROD-001",
        "vendor_id": "vendor-uuid",
        "vendor_price": "100.00",
        "market_avg_price": "105.00",
        "price_deviation": "-4.76",
        "is_competitive": true,
        "last_updated": "2026-02-07T10:00:00Z"
      }
    ],
    "count": 50
  },
  "message": "Vendor pricing data retrieved successfully"
}
```

---

### 7. Compare Multiple Vendors

Compare performance metrics across multiple vendors.

**Endpoint**: `POST /api/v1/vendor-performance/compare`

**Access**: Admin, Operator

**Request Body**:
```json
{
  "vendorIds": ["vendor-uuid-1", "vendor-uuid-2", "vendor-uuid-3"]
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/vendor-performance/compare" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vendorIds": ["vendor-uuid-1", "vendor-uuid-2"]}'
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "vendorId": "vendor-uuid-1",
        "vendorName": "John Doe",
        "businessName": "ABC Distributors",
        "performance": {
          "acceptance_rate": "96.67",
          "completion_rate": "96.55",
          "reliability_score": "92.45"
        },
        "grade": {
          "grade": "A+",
          "label": "Excellent",
          "color": "#10b981"
        }
      },
      {
        "vendorId": "vendor-uuid-2",
        "vendorName": "Jane Smith",
        "businessName": "XYZ Suppliers",
        "performance": {
          "acceptance_rate": "88.00",
          "completion_rate": "90.00",
          "reliability_score": "85.50"
        },
        "grade": {
          "grade": "A",
          "label": "Very Good",
          "color": "#22c55e"
        }
      }
    ],
    "count": 2
  },
  "message": "Vendor comparison completed successfully"
}
```

---

### 8. Get Top Performing Vendors

Get list of top performing vendors by reliability score.

**Endpoint**: `GET /api/v1/vendor-performance/top-performers`

**Access**: Admin, Operator

**Query Parameters**:
- `limit` (optional): Number of vendors (default: 10)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance/top-performers?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "topPerformers": [
      {
        "vendor_id": "vendor-uuid",
        "vendor_name": "ABC Distributors",
        "reliability_score": "95.50",
        "acceptance_rate": "98.00",
        "completion_rate": "97.00"
      }
    ],
    "count": 5
  },
  "message": "Top performers retrieved successfully"
}
```

---

### 9. Get Vendors Needing Attention

Get list of vendors with low performance scores.

**Endpoint**: `GET /api/v1/vendor-performance/needs-attention`

**Access**: Admin, Operator

**Query Parameters**:
- `threshold` (optional): Reliability score threshold (default: 60)

**Example Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/vendor-performance/needs-attention?threshold=70" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "vendor_id": "vendor-uuid",
        "vendor_name": "Low Performer Inc",
        "reliability_score": "55.00",
        "acceptance_rate": "70.00",
        "completion_rate": "65.00",
        "cancellation_rate": "15.00"
      }
    ],
    "count": 3,
    "threshold": 70
  },
  "message": "Vendors needing attention retrieved successfully"
}
```

---

### 10. Recalculate Vendor Performance

Manually trigger performance recalculation for a specific vendor.

**Endpoint**: `POST /api/v1/vendor-performance/:vendorId/recalculate`

**Access**: Admin, Operator

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/vendor-performance/vendor-uuid/recalculate" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "vendor_id": "vendor-uuid",
    "reliability_score": "92.45",
    "acceptance_rate": "96.67",
    "completion_rate": "96.55",
    "last_calculated_at": "2026-02-07T10:30:00Z"
  },
  "message": "Vendor performance recalculated successfully"
}
```

---

### 11. Recalculate All Vendors Performance

Trigger performance recalculation for all vendors (batch operation).

**Endpoint**: `POST /api/v1/vendor-performance/recalculate-all`

**Access**: Admin only

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/vendor-performance/recalculate-all" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "total": 50,
    "successful": 48,
    "failed": 2,
    "results": [
      {
        "vendorId": "vendor-uuid-1",
        "success": true,
        "performance": { ... }
      }
    ]
  },
  "message": "All vendors performance recalculated successfully"
}
```

---

### 12. Update Vendor Pricing

Update vendor pricing for a product (triggers price competitiveness recalculation).

**Endpoint**: `POST /api/v1/vendor-performance/:vendorId/pricing/:productId`

**Access**: Admin, Operator, Vendor (own products only)

**Request Body**:
```json
{
  "vendorPrice": 105.50
}
```

**Example Request**:
```bash
curl -X POST "http://localhost:3000/api/v1/vendor-performance/vendor-uuid/pricing/product-uuid" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vendorPrice": 105.50}'
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "productId": "product-uuid",
    "vendorId": "vendor-uuid",
    "vendorPrice": 105.50,
    "marketAvgPrice": 110.00,
    "priceDeviation": -4.09,
    "isCompetitive": true
  },
  "message": "Vendor pricing updated successfully"
}
```

---

## Integration with Order Routing

The vendor performance system is fully integrated with the order routing engine:

1. **Reliability Score**: Used as one of the 5 criteria (15% weight) in vendor selection
2. **Automatic Updates**: Performance metrics update automatically when:
   - Vendor accepts/rejects an order
   - Order is completed
   - Order is cancelled
   - Delivery is late/on-time
3. **Routing Priority**: Vendors with higher reliability scores get priority in order routing
4. **Fallback Logic**: If a high-performing vendor rejects, system routes to next best vendor

---

## Background Worker

The Vendor Performance Worker runs automatically:

- **Schedule**: Every 6 hours
- **Function**: Recalculates performance metrics for all vendors
- **Logging**: All operations logged to `logs/combined-*.log`
- **Manual Trigger**: Can be triggered via API endpoint

---

## Performance Grades

| Score Range | Grade | Label | Color | Description |
|-------------|-------|-------|-------|-------------|
| 90-100 | A+ | Excellent | Green | Outstanding performance |
| 80-89 | A | Very Good | Light Green | Consistently good |
| 70-79 | B | Good | Yellow-Green | Acceptable performance |
| 60-69 | C | Fair | Yellow | Needs improvement |
| 50-59 | D | Poor | Orange | Significant issues |
| 0-49 | F | Very Poor | Red | Critical performance problems |

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (in development mode)"
}
```

**Common HTTP Status Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

---

## Best Practices

1. **Regular Monitoring**: Check vendor performance dashboard weekly
2. **Threshold Alerts**: Monitor vendors below 70 reliability score
3. **Price Updates**: Update vendor pricing regularly for accurate competitiveness index
4. **Performance Reviews**: Conduct quarterly reviews with low-performing vendors
5. **Data Accuracy**: Ensure order statuses are updated promptly for accurate metrics

---

## Notes

- All decimal values are returned as strings to preserve precision
- Timestamps are in ISO 8601 format (UTC)
- Performance calculations are cached and updated periodically
- Historical data is preserved for trend analysis
- Vendor performance affects routing but doesn't block orders (unless manually blocked)
