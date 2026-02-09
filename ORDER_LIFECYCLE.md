# Order Lifecycle Documentation

## Overview
Complete B2B order lifecycle from WhatsApp message to completion with automatic credit ledger updates.

## Order Statuses

### 1. DRAFT
**Trigger**: Retailer sends WhatsApp message with order items
**Actions**:
- System identifies retailer by phone number
- Parses order items from message
- Validates products and stock availability
- Creates draft order
- Sends confirmation to retailer

**Example WhatsApp Message**:
```
RICE-1KG x 10
DAL-1KG x 5
OIL-1L x 3
```

**System Response**:
```
📝 Draft Order Created!

Order #ORD260100001
Total: Rs.2,500

Your order is being reviewed by our team.
You'll be notified once confirmed.
```

### 2. CONFIRMED
**Trigger**: Admin/Operator confirms order
**Actions**:
- Order validated by admin
- Status changed to CONFIRMED
- Retailer notified via WhatsApp

**API Endpoint**:
```http
POST /api/v1/order-lifecycle/:id/confirm
Authorization: Bearer <admin_token>
```

**WhatsApp Notification**:
```
✅ Order Confirmed!

Order #ORD260100001
Total: Rs.2,500

We're now assigning a vendor to fulfill your order.
```

### 3. VENDOR_ASSIGNED
**Trigger**: Admin/Operator assigns vendor
**Actions**:
- Vendor assigned to order
- Both vendor and retailer notified
- Vendor receives order details

**API Endpoint**:
```http
POST /api/v1/order-lifecycle/:id/assign-vendor
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "vendorId": "uuid"
}
```

**Vendor Notification**:
```
📦 New Order Assigned!

Order #ORD260100001
Retailer: XYZ Store

Items:
10x Rice (1kg) @ Rs.80
5x Dal (1kg) @ Rs.120

Total: Rs.2,500

Please accept or reject this order.
```

### 4. ACCEPTED
**Trigger**: Vendor accepts order
**Actions**:
- Stock reserved from vendor inventory
- Credit ledger entry created (ORDER_CREDIT)
- Retailer's outstanding debt increased
- Retailer notified

**API Endpoint**:
```http
POST /api/v1/order-lifecycle/:id/accept
Authorization: Bearer <vendor_token>
```

**Credit Ledger Entry**:
```
Transaction Type: ORDER_CREDIT
Amount: Rs.2,500
Running Balance: Rs.2,500
Description: Order ORD260100001 - Credit
```

**Stock Update**:
```sql
UPDATE vendor_products 
SET stock = stock - quantity 
WHERE vendor_id = ? AND product_id = ?
```

### 5. DISPATCHED
**Trigger**: Vendor dispatches order
**Actions**:
- Order marked as dispatched
- Shipping timestamp recorded
- Expected delivery date set (optional)
- Retailer notified

**API Endpoint**:
```http
POST /api/v1/order-lifecycle/:id/dispatch
Authorization: Bearer <vendor_token>
Content-Type: application/json

{
  "expectedDelivery": "2026-02-10T00:00:00Z"
}
```

**WhatsApp Notification**:
```
🚚 Order Dispatched!

Order #ORD260100001
Expected Delivery: Feb 10, 2026

Your order is on the way!
```

### 6. DELIVERED
**Trigger**: Vendor confirms delivery
**Actions**:
- Order marked as delivered
- Delivery timestamp recorded
- Retailer stats updated (total_orders, total_spent)
- Retailer notified

**API Endpoint**:
```http
POST /api/v1/order-lifecycle/:id/deliver
Authorization: Bearer <vendor_token>
```

**Retailer Stats Update**:
```sql
UPDATE retailers SET
  total_orders = total_orders + 1,
  total_spent = total_spent + order_total,
  last_order_at = NOW()
WHERE id = ?
```

### 7. COMPLETED
**Trigger**: Admin/Operator marks order complete
**Actions**:
- Order finalized
- Vendor stats updated (total_sales)
- Credit score recalculated
- Order cannot be modified

**API Endpoint**:
```http
POST /api/v1/order-lifecycle/:id/complete
Authorization: Bearer <admin_token>
```

**Vendor Stats Update**:
```sql
UPDATE vendors SET
  total_sales = total_sales + order_total
WHERE id = ?
```

### 8. CANCELLED
**Trigger**: Admin/Operator/Vendor cancels order
**Actions**:
- Stock restored (if order was ACCEPTED or later)
- Credit ledger reversal entry created (REFUND_DEBIT)
- Retailer's outstanding debt decreased
- Both parties notified

**API Endpoint**:
```http
POST /api/v1/order-lifecycle/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Out of stock"
}
```

**Reversal Logic**:
```javascript
// Restore stock
UPDATE vendor_products 
SET stock = stock + quantity

// Create reversal entry
INSERT INTO credit_ledgers (
  transaction_type: 'REFUND_DEBIT',
  amount: order.dueAmount,
  running_balance: previous_balance - order.dueAmount
)

// Update retailer debt
UPDATE retailers 
SET outstanding_debt = outstanding_debt - order.dueAmount
```

## State Transition Rules

```
DRAFT → [CONFIRMED, CANCELLED]
CONFIRMED → [VENDOR_ASSIGNED, CANCELLED]
VENDOR_ASSIGNED → [ACCEPTED, CANCELLED]
ACCEPTED → [DISPATCHED, CANCELLED]
DISPATCHED → [DELIVERED, CANCELLED]
DELIVERED → [COMPLETED, CANCELLED]
COMPLETED → []
CANCELLED → []
```

**Validation**: Database trigger prevents invalid transitions

## WhatsApp Order Parsing

### Supported Formats

1. **SKU x Quantity**
```
RICE-1KG x 10
DAL-1KG x 5
```

2. **SKU-Quantity**
```
RICE-1KG-10
DAL-1KG-5
```

3. **SKU:Quantity**
```
RICE-1KG:10
DAL-1KG:5
```

4. **Quantity x SKU**
```
10 x RICE-1KG
5 x DAL-1KG
```

### Order Status Query

**Retailer Message**:
```
Order #ORD260100001
```

**System Response**:
```
🚚 Order Status

Order #ORD260100001
Status: DISPATCHED
Vendor: ABC Wholesale
Total: Rs.2,500
Paid: Rs.0
Due: Rs.2,500
```

## Credit Ledger Integration

### Order Acceptance
```javascript
{
  ledgerNumber: "LED260100001",
  transactionType: "ORDER_CREDIT",
  amount: 2500,
  runningBalance: 2500,
  previousBalance: 0,
  description: "Order ORD260100001 - Credit"
}
```

### Order Cancellation
```javascript
{
  ledgerNumber: "LED260100002",
  transactionType: "REFUND_DEBIT",
  amount: 2500,
  runningBalance: 0,
  previousBalance: 2500,
  description: "Order ORD260100001 - Cancelled"
}
```

### Payment
```javascript
{
  ledgerNumber: "LED260100003",
  transactionType: "PAYMENT_DEBIT",
  amount: 1000,
  runningBalance: 1500,
  previousBalance: 2500,
  description: "Payment for order ORD260100001"
}
```

## Status Logging

Every transition is logged in `order_status_logs`:

```javascript
{
  orderId: "uuid",
  fromStatus: "ACCEPTED",
  toStatus: "DISPATCHED",
  changedBy: "user_uuid",
  notes: "Order dispatched for delivery",
  createdAt: "2026-02-06T10:30:00Z"
}
```

**Query Status History**:
```http
GET /api/v1/order-lifecycle/:id/history
Authorization: Bearer <token>
```

**Response**:
```json
[
  {
    "fromStatus": null,
    "toStatus": "DRAFT",
    "changedBy": null,
    "notes": "Order created from WhatsApp",
    "createdAt": "2026-02-06T10:00:00Z"
  },
  {
    "fromStatus": "DRAFT",
    "toStatus": "CONFIRMED",
    "changedBy": {
      "name": "Admin User",
      "role": "ADMIN"
    },
    "notes": "Order confirmed by admin",
    "createdAt": "2026-02-06T10:15:00Z"
  }
]
```

## Error Handling

### Invalid Transition
```javascript
// Attempt: DRAFT → DISPATCHED
{
  "success": false,
  "message": "Invalid transition from DRAFT to DISPATCHED. Valid transitions: CONFIRMED, CANCELLED"
}
```

### Insufficient Stock
```javascript
{
  "success": false,
  "message": "Insufficient stock for Rice (1kg)"
}
```

### Non-Retailer Order
```javascript
{
  "success": false,
  "message": "Only registered retailers can place orders. Please contact admin."
}
```

## Performance Considerations

1. **Indexed Queries**: All status queries use indexed columns
2. **Async Notifications**: WhatsApp messages sent asynchronously
3. **Transaction Safety**: All state changes wrapped in database transactions
4. **Idempotency**: Status transitions are idempotent

## Monitoring

### Key Metrics
- Orders by status (dashboard)
- Average time per status
- Cancellation rate
- Vendor acceptance rate

### Alerts
- Orders stuck in DRAFT > 24 hours
- Orders stuck in VENDOR_ASSIGNED > 12 hours
- High cancellation rate (> 10%)

## Testing

### Manual Testing Flow
1. Send WhatsApp order → Check DRAFT status
2. Confirm order → Check CONFIRMED status
3. Assign vendor → Check notifications
4. Accept order → Verify stock deduction
5. Dispatch → Check delivery tracking
6. Deliver → Verify stats update
7. Complete → Check credit score update

### Cancel at Each Stage
Test cancellation from each status to verify:
- Stock restoration
- Credit reversal
- Notifications
