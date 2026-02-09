# Smart Order Routing API Documentation

## Overview

The Smart Order Routing Engine automatically selects the best vendor for each order based on multiple criteria including product availability, location proximity, vendor workload, price competitiveness, and reliability score.

## Key Features

✅ **Automatic Vendor Selection** - AI-powered routing based on weighted criteria
✅ **Manual Override** - Admin can manually assign orders to specific vendors
✅ **Vendor Ranking** - Internal scoring and ranking of all eligible vendors
✅ **Decision Logging** - Complete audit trail of routing decisions with reasons
✅ **Fallback Mechanism** - Automatic routing to next best vendor if order not accepted
✅ **Time-based Acceptance** - Configurable deadline for vendor acceptance
✅ **Real-time Scoring** - Vendor scores updated based on current workload and performance

---

## Routing Criteria

### 1. Product Availability (Weight: 30%)
- Checks if vendor has all required products in stock
- Scores based on stock levels vs order quantity
- 100 points: Stock >= 2x order quantity
- 70 points: Stock >= order quantity
- 30 points: Insufficient stock

### 2. Location Proximity (Weight: 20%)
- Same city: +20 bonus points
- Same state: +10 bonus points
- Base score: 50 points
- Reduces delivery time and costs

### 3. Vendor Workload (Weight: 15%)
- Counts active orders (CONFIRMED, ACCEPTED, DISPATCHED)
- 100 points: ≤5 active orders (low workload)
- 80 points: ≤10 active orders (medium workload)
- 60 points: ≤20 active orders (high workload)
- 40 points: ≤30 active orders (very high)
- 20 points: >30 active orders (overloaded)

### 4. Price Competitiveness (Weight: 20%)
- Compares vendor prices for order items
- Lower prices = higher scores
- Normalized to 0-100 scale

### 5. Vendor Reliability (Weight: 15%)
- Based on vendor rating (0-5 stars)
- Converted to 0-100 scale
- +10 bonus for established vendors (>100k sales)

---

## API Endpoints

### 1. Route Order (Automatic)

**POST** `/api/v1/order-routing/:orderId/route`

Automatically route order to best vendor based on criteria.

**Access:** Admin, Vendor

**Request:**
```json
{
  // No body needed for automatic routing
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "selectedVendor": "vendor-uuid",
    "fallbackVendor": "fallback-vendor-uuid",
    "routingLog": {
      "id": "log-uuid",
      "routingReason": "Selected vendor: ABC Wholesale (VEN001). Overall score: 87.50/100. Rank: #1 out of 5 eligible vendors. Top factors: availability (95), reliability (90)",
      "acceptanceDeadline": "2026-02-07T12:00:00Z"
    },
    "rankedVendors": [
      {
        "vendorId": "uuid",
        "vendorCode": "VEN001",
        "vendorName": "ABC Wholesale",
        "rank": 1,
        "overallScore": "87.50",
        "scores": {
          "availability": "95.00",
          "proximity": "70.00",
          "workload": "80.00",
          "price": "75.00",
          "reliability": "90.00"
        },
        "details": {
          "location": {
            "city": "Birendranagar",
            "state": "Karnali"
          },
          "rating": 4.5,
          "totalSales": 250000
        }
      }
    ],
    "acceptanceDeadline": "2026-02-07T12:00:00Z"
  }
}
```

---

### 2. Route Order (Manual Override)

**POST** `/api/v1/order-routing/:orderId/route`

Manually assign order to specific vendor (admin override).

**Access:** Admin

**Request:**
```json
{
  "vendorId": "vendor-uuid",
  "overrideReason": "Customer requested specific vendor"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "selectedVendor": "vendor-uuid",
    "routingLog": {
      "id": "log-uuid",
      "isManualOverride": true,
      "overrideReason": "Customer requested specific vendor"
    },
    "isManualOverride": true
  }
}
```

---

### 3. Get Routing Logs

**GET** `/api/v1/order-routing/:orderId/logs`

Get complete routing history for an order.

**Access:** Admin, Vendor

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "orderId": "order-uuid",
      "routingAttempt": 1,
      "selectedVendorId": "vendor-uuid",
      "fallbackVendorId": "fallback-uuid",
      "routingReason": "Selected vendor: ABC Wholesale...",
      "vendorsEvaluated": [
        {
          "vendorId": "uuid",
          "vendorCode": "VEN001",
          "overallScore": 87.50,
          "scores": {...},
          "rank": 1
        }
      ],
      "routingCriteria": {
        "weights": {
          "availability": 30,
          "proximity": 20,
          "workload": 15,
          "price": 20,
          "reliability": 15
        }
      },
      "acceptanceDeadline": "2026-02-07T12:00:00Z",
      "acceptedAt": "2026-02-07T10:30:00Z",
      "isManualOverride": false,
      "createdAt": "2026-02-07T10:00:00Z"
    }
  ]
}
```

---

### 4. Get Acceptance Status

**GET** `/api/v1/order-routing/:orderId/acceptance-status`

Get vendor acceptance/rejection status for an order.

**Access:** Admin, Vendor

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "acceptance-uuid",
      "vendorId": "vendor-uuid",
      "orderId": "order-uuid",
      "status": "ACCEPTED",
      "notifiedAt": "2026-02-07T10:00:00Z",
      "responseDeadline": "2026-02-07T12:00:00Z",
      "respondedAt": "2026-02-07T10:30:00Z",
      "responseTimeMinutes": 30,
      "rejectionReason": null
    }
  ]
}
```

---

### 5. Vendor Response (Accept/Reject)

**POST** `/api/v1/order-routing/acceptance/:acceptanceId/respond`

Vendor accepts or rejects assigned order.

**Access:** Vendor

**Request (Accept):**
```json
{
  "response": "ACCEPTED"
}
```

**Request (Reject):**
```json
{
  "response": "REJECTED",
  "reason": "Insufficient stock due to unexpected demand"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accepted": true
  }
}
```

**Response (Rejected - Fallback Triggered):**
```json
{
  "success": true,
  "data": {
    "accepted": false,
    "fallbackTriggered": true
  }
}
```

---

### 6. Trigger Fallback Routing

**POST** `/api/v1/order-routing/:orderId/fallback`

Manually trigger fallback to next best vendor.

**Access:** Admin

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new-log-uuid",
    "orderId": "order-uuid",
    "routingAttempt": 2,
    "selectedVendorId": "fallback-vendor-uuid",
    "routingReason": "Fallback routing - primary vendor rejected order"
  }
}
```

---

### 7. Get Routing Configuration

**GET** `/api/v1/order-routing/config`

Get current routing configuration.

**Access:** Admin

**Response:**
```json
{
  "success": true,
  "data": {
    "routing_weights": {
      "availability": 30,
      "proximity": 20,
      "workload": 15,
      "price": 20,
      "reliability": 15
    },
    "acceptance_timeout": {
      "hours": 2,
      "fallback_enabled": true
    },
    "proximity_calculation": {
      "method": "city_based",
      "same_city_bonus": 20,
      "same_state_bonus": 10
    },
    "workload_thresholds": {
      "low": 5,
      "medium": 10,
      "high": 20,
      "max": 30
    },
    "price_tolerance": {
      "max_difference_percent": 15,
      "prefer_lower": true
    },
    "min_reliability_score": {
      "score": 3.0,
      "allow_override": true
    },
    "auto_routing_enabled": {
      "enabled": true,
      "require_admin_approval": false
    }
  }
}
```

---

### 8. Update Routing Configuration

**PUT** `/api/v1/order-routing/config/:configKey`

Update routing configuration parameter.

**Access:** Admin

**Request:**
```json
{
  "configValue": {
    "availability": 35,
    "proximity": 20,
    "workload": 15,
    "price": 15,
    "reliability": 15
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config-uuid",
    "configKey": "routing_weights",
    "configValue": {...},
    "updatedAt": "2026-02-07T10:00:00Z"
  }
}
```

---

### 9. Get Vendor Scores

**GET** `/api/v1/order-routing/vendor-scores`

Get routing scores for all vendors.

**Access:** Admin, Vendor

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "score-uuid",
      "vendorId": "vendor-uuid",
      "availabilityScore": 85.50,
      "proximityScore": 70.00,
      "workloadScore": 80.00,
      "priceScore": 75.00,
      "reliabilityScore": 90.00,
      "overallScore": 80.25,
      "activeOrdersCount": 8,
      "pendingOrdersCount": 3,
      "averageFulfillmentTime": 48,
      "lastCalculatedAt": "2026-02-07T09:00:00Z"
    }
  ]
}
```

---

## Routing Flow

### Automatic Routing

1. **Order Created** → System receives new order
2. **Find Eligible Vendors** → Check product availability and stock
3. **Score Vendors** → Calculate scores for each criterion
4. **Rank Vendors** → Sort by overall weighted score
5. **Select Best Vendor** → Choose #1 ranked vendor
6. **Identify Fallback** → Set #2 ranked vendor as fallback
7. **Notify Vendor** → Send acceptance request
8. **Set Deadline** → 2-hour acceptance window
9. **Log Decision** → Record routing details and reasons

### Vendor Acceptance

1. **Vendor Notified** → Receives order assignment
2. **Review Order** → Check capacity and stock
3. **Accept/Reject** → Respond within deadline
4. **If Accepted** → Order proceeds to fulfillment
5. **If Rejected** → Automatic fallback triggered
6. **If Expired** → Automatic fallback after deadline

### Fallback Routing

1. **Primary Rejected/Expired** → First vendor didn't accept
2. **Route to Fallback** → Assign to #2 ranked vendor
3. **New Deadline** → Fresh 2-hour window
4. **Log Attempt** → Record fallback routing
5. **Repeat if Needed** → Continue until accepted

---

## Configuration Guide

### Adjusting Weights

Weights must total 100%. Adjust based on business priorities:

**Prioritize Speed:**
```json
{
  "availability": 35,
  "proximity": 30,
  "workload": 20,
  "price": 10,
  "reliability": 5
}
```

**Prioritize Cost:**
```json
{
  "availability": 25,
  "proximity": 15,
  "workload": 10,
  "price": 35,
  "reliability": 15
}
```

**Balanced:**
```json
{
  "availability": 30,
  "proximity": 20,
  "workload": 15,
  "price": 20,
  "reliability": 15
}
```

### Acceptance Timeout

```json
{
  "hours": 2,              // Time limit for vendor response
  "fallback_enabled": true // Auto-fallback if expired
}
```

Recommended: 1-4 hours depending on business hours

### Workload Thresholds

```json
{
  "low": 5,     // Excellent capacity
  "medium": 10, // Good capacity
  "high": 20,   // Limited capacity
  "max": 30     // Near capacity
}
```

Adjust based on average vendor capacity

---

## Best Practices

### For Admins

1. **Monitor Routing Logs** - Review decisions regularly
2. **Adjust Weights** - Fine-tune based on performance
3. **Handle Exceptions** - Use manual override when needed
4. **Track Fallbacks** - Investigate frequent fallbacks
5. **Update Thresholds** - Adjust as business scales

### For Vendors

1. **Respond Quickly** - Accept/reject within deadline
2. **Maintain Stock** - Keep inventory updated
3. **Manage Workload** - Don't overcommit
4. **Provide Reasons** - Explain rejections clearly
5. **Build Reliability** - Consistent performance improves scores

---

## Automated Worker

The Order Routing Worker runs every 15 minutes to:
- Check for expired vendor acceptances
- Automatically trigger fallback routing
- Update vendor routing scores
- Log timeout events

---

## Error Handling

### No Eligible Vendors
```json
{
  "success": false,
  "message": "No eligible vendors found for this order"
}
```

**Causes:**
- No vendor has all required products
- All vendors below minimum reliability score
- All vendors at maximum capacity

**Solution:** Check product availability or adjust criteria

### Acceptance Already Responded
```json
{
  "success": false,
  "message": "Order already responded to"
}
```

**Cause:** Vendor trying to respond twice

**Solution:** Check current status first

### No Fallback Available
```json
{
  "success": false,
  "message": "No fallback vendor available"
}
```

**Cause:** Only one eligible vendor, already rejected

**Solution:** Manual intervention required

---

## Integration Example

```javascript
// Create order
const order = await createOrder(orderData);

// Route to vendor
const routing = await fetch(`/api/v1/order-routing/${order.id}/route`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const result = await routing.json();

// Monitor acceptance
const checkAcceptance = setInterval(async () => {
  const status = await fetch(
    `/api/v1/order-routing/${order.id}/acceptance-status`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  const data = await status.json();
  
  if (data.data[0].status === 'ACCEPTED') {
    clearInterval(checkAcceptance);
    // Proceed with order fulfillment
  }
}, 60000); // Check every minute
```

---

## Changelog

### Version 1.0 (2026-02-07)
- Initial release
- Automatic vendor selection
- Manual override capability
- Fallback routing
- Configurable weights and thresholds
- Vendor acceptance tracking
- Complete audit logging
