# Risk Control API Documentation

## Overview

The Risk Control system provides automated monitoring and enforcement of credit and payment policies. It automatically:

- Reduces credit limits when payment delays exceed thresholds
- Blocks new orders if credit is overdue beyond defined days
- Alerts admins about high-risk retailers
- Flags unusual order spikes
- Maintains configurable risk rules

## API Endpoints

### 1. Get Risk Dashboard

**GET** `/api/v1/risk-control/dashboard`

Get comprehensive risk control dashboard with critical alerts, high-risk retailers, and recent actions.

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "criticalAlertsCount": 5,
    "highRiskRetailersCount": 12,
    "recentActionsCount": 8,
    "criticalAlerts": [...],
    "highRiskRetailers": [...],
    "recentActions": [...],
    "configs": [...]
  }
}
```

---

### 2. Get Risk Configurations

**GET** `/api/v1/risk-control/configs`

Get all risk control configurations.

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "configKey": "payment_delay_threshold",
      "configValue": {
        "warning_days": 7,
        "critical_days": 15,
        "credit_reduction_percent": 25
      },
      "description": "Payment delay thresholds and actions",
      "isActive": true
    }
  ]
}
```

---

### 3. Update Risk Configuration

**PUT** `/api/v1/risk-control/configs/:configKey`

Update a specific risk configuration.

**Access:** Admin only

**Request Body:**
```json
{
  "configValue": {
    "warning_days": 10,
    "critical_days": 20,
    "credit_reduction_percent": 30
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "configKey": "payment_delay_threshold",
    "configValue": {...},
    "updatedAt": "2026-02-06T10:00:00Z"
  }
}
```

---

### 4. Get Risk Alerts

**GET** `/api/v1/risk-control/alerts`

Get risk alerts with optional filters.

**Access:** Admin, Vendor

**Query Parameters:**
- `severity` (optional): LOW, MEDIUM, HIGH, CRITICAL
- `alertType` (optional): CREDIT_LIMIT_REDUCED, ORDER_BLOCKED, HIGH_RISK_RETAILER, UNUSUAL_SPIKE
- `retailerId` (optional): Filter by retailer
- `isAcknowledged` (optional): true/false
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "alertType": "HIGH_RISK_RETAILER",
      "severity": "HIGH",
      "retailerId": "uuid",
      "title": "High-Risk Retailer Detected",
      "description": "Retailer has a risk score of 75 (HIGH)...",
      "metadata": {...},
      "isAcknowledged": false,
      "createdAt": "2026-02-06T10:00:00Z"
    }
  ]
}
```

---

### 5. Acknowledge Alert

**PUT** `/api/v1/risk-control/alerts/:alertId/acknowledge`

Mark a risk alert as acknowledged.

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "isAcknowledged": true,
    "acknowledgedBy": "admin-user-id",
    "acknowledgedAt": "2026-02-06T10:00:00Z"
  }
}
```

---

### 6. Get Retailer Risk Score

**GET** `/api/v1/risk-control/retailers/:retailerId/score`

Get current risk score for a retailer.

**Access:** Admin, Vendor

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "retailerId": "uuid",
    "riskScore": 45.50,
    "riskLevel": "MEDIUM",
    "paymentDelayScore": 30.00,
    "creditUtilizationScore": 60.00,
    "orderPatternScore": 20.00,
    "overdueAmount": 15000.00,
    "daysOverdue": 5,
    "consecutiveDelays": 2,
    "unusualActivityCount": 0,
    "lastCalculatedAt": "2026-02-06T10:00:00Z"
  }
}
```

---

### 7. Calculate Risk Score

**POST** `/api/v1/risk-control/retailers/:retailerId/calculate`

Manually trigger risk score calculation for a retailer.

**Access:** Admin, Vendor

**Response:**
```json
{
  "success": true,
  "data": {
    "riskScore": 45.50,
    "riskLevel": "MEDIUM",
    ...
  }
}
```

---

### 8. Apply Automated Controls

**POST** `/api/v1/risk-control/retailers/:retailerId/apply-controls`

Manually trigger automated risk controls for a retailer.

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "riskScore": {...},
    "actions": [
      {
        "id": "uuid",
        "actionType": "CREDIT_LIMIT_REDUCED",
        "reason": "Consecutive payment delays: 3",
        "previousValue": {"creditLimit": 100000},
        "newValue": {"creditLimit": 75000}
      }
    ]
  }
}
```

---

### 9. Get Risk Actions History

**GET** `/api/v1/risk-control/retailers/:retailerId/actions`

Get history of risk control actions for a retailer.

**Access:** Admin, Vendor

**Query Parameters:**
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "actionType": "CREDIT_LIMIT_REDUCED",
      "retailerId": "uuid",
      "triggeredBy": "PAYMENT_DELAY",
      "previousValue": {"creditLimit": 100000},
      "newValue": {"creditLimit": 75000},
      "reason": "Consecutive payment delays: 3",
      "isAutomatic": true,
      "createdAt": "2026-02-06T10:00:00Z"
    }
  ]
}
```

---

## Risk Configuration Keys

### 1. payment_delay_threshold
Controls when to take action on payment delays.

```json
{
  "warning_days": 7,
  "critical_days": 15,
  "credit_reduction_percent": 25
}
```

### 2. credit_overdue_blocking
Controls when to block orders due to overdue payments.

```json
{
  "block_threshold_days": 30,
  "warning_threshold_days": 15
}
```

### 3. high_risk_thresholds
Thresholds for high-risk retailer alerts.

```json
{
  "risk_score_threshold": 70,
  "consecutive_delays_threshold": 3,
  "overdue_amount_threshold": 50000
}
```

### 4. unusual_order_detection
Parameters for detecting unusual order spikes.

```json
{
  "spike_multiplier": 3,
  "spike_window_days": 7,
  "min_orders_for_baseline": 5
}
```

### 5. credit_limit_rules
Rules for credit limit adjustments.

```json
{
  "min_credit_limit": 10000,
  "max_reduction_percent": 50,
  "auto_restore_after_days": 90
}
```

### 6. risk_score_weights
Weights for risk score calculation (must total 100).

```json
{
  "payment_delay": 40,
  "credit_utilization": 30,
  "order_pattern": 20,
  "overdue_amount": 10
}
```

---

## Automated Actions

### 1. Credit Limit Reduction
**Trigger:** Consecutive payment delays >= 3

**Action:** Reduce credit limit by configured percentage (default: 25%)

**Minimum:** Credit limit won't go below configured minimum (default: 10,000)

### 2. Order Blocking
**Trigger:** Payment overdue >= configured days (default: 30 days)

**Action:** Set retailer.isApproved = false, blocking new orders

**Recovery:** Admin must manually approve after payment

### 3. High-Risk Alerts
**Trigger:** Risk score >= configured threshold (default: 70)

**Action:** Create alert for admin review

**Severity:** Based on risk level (HIGH or CRITICAL)

### 4. Unusual Activity Alerts
**Trigger:** Order volume >= configured multiplier (default: 3x) of baseline

**Action:** Create alert for admin review

**Severity:** MEDIUM

---

## Risk Score Calculation

Risk score is calculated on a 0-100 scale using weighted components:

1. **Payment Delay Score (40%)**: Based on average payment delay and ratio of delayed payments
2. **Credit Utilization Score (30%)**: Based on outstanding debt vs credit limit
3. **Order Pattern Score (20%)**: Based on cancellation rate, incomplete orders, and order value volatility
4. **Overdue Score (10%)**: Based on overdue amount relative to credit limit

### Risk Levels
- **LOW**: Score 0-29
- **MEDIUM**: Score 30-49
- **HIGH**: Score 50-69
- **CRITICAL**: Score 70-100

---

## Automated Worker

The risk control worker runs hourly and:

1. Checks all active retailers with outstanding debt or recent activity
2. Calculates current risk scores
3. Applies automated controls based on thresholds
4. Creates alerts for admin review
5. Logs all actions taken

### Manual Triggers

Risk controls can also be triggered:
- After each payment (automatic)
- After order status changes to OVERDUE or CANCELLED (automatic)
- Via API endpoint (manual)

---

## Integration with Order Creation

Before creating an order, the system checks:

1. Is retailer approved?
2. Is payment overdue beyond warning threshold?
3. Is payment overdue beyond blocking threshold?
4. Is credit limit exceeded?

If any check fails, order creation is blocked with appropriate error message.

---

## Best Practices

1. **Review alerts daily**: Check the risk dashboard for critical alerts
2. **Adjust thresholds gradually**: Start conservative and adjust based on business needs
3. **Monitor false positives**: Track if automated actions are too aggressive
4. **Communicate with retailers**: Inform retailers about risk policies upfront
5. **Regular audits**: Review risk actions history to ensure fairness
6. **Credit limit restoration**: System auto-restores limits after 90 days of good behavior

---

## Example Workflow

1. **Retailer places order** → System checks eligibility
2. **Payment is delayed** → Risk score increases
3. **3 consecutive delays** → Credit limit reduced automatically
4. **30 days overdue** → Orders blocked automatically
5. **Admin receives alert** → Reviews and takes action
6. **Retailer makes payment** → Risk score recalculated
7. **90 days good behavior** → Credit limit restored automatically
