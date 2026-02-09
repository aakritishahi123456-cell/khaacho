# Failure Recovery System

## Overview

The Failure Recovery System ensures **zero data loss** and automatic recovery from crashes, timeouts, and failures. No order is ever lost, even if the server crashes during processing.

## Key Features

### 1. Webhook Event Storage
- **Store Before Processing**: All webhook events are stored in the database BEFORE processing
- **Crash Recovery**: If server crashes, pending events are automatically processed on restart
- **Automatic Retries**: Failed events are retried up to 3 times with exponential backoff
- **Stuck Detection**: Events stuck in processing state are automatically recovered

### 2. Workflow State Tracking
- **Progress Tracking**: Every workflow step is tracked in the database
- **Heartbeat Monitoring**: Regular heartbeats detect crashed workflows
- **Resume Capability**: Incomplete workflows are automatically resumed from last checkpoint
- **Step-by-Step Recovery**: Workflows resume from exact point of failure

### 3. Vendor Assignment Retry
- **Automatic Retry**: If vendor doesn't respond, automatically route to next best vendor
- **Timeout Handling**: 2-hour response deadline with automatic fallback
- **Multiple Attempts**: Up to 5 vendor assignment attempts per order
- **Pending Status**: Orders marked as PENDING (not FAILED) during retry process

### 4. Order Recovery
- **Never Lost**: Orders are never marked as FAILED, always PENDING for recovery
- **Failure Point Tracking**: Exact failure point recorded for targeted recovery
- **Automatic Recovery**: Pending recoveries processed every 2 minutes
- **Manual Recovery**: Admin can manually trigger recovery if needed

### 5. Idempotency
- **Duplicate Prevention**: Idempotency keys prevent duplicate processing
- **24-Hour Window**: Keys valid for 24 hours
- **Safe Retries**: Retries return same result as original request

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Incoming Request                          │
│              (Webhook, API Call, etc.)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: Store Event/Workflow                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  • Store webhook event in database                  │    │
│  │  • Create workflow state record                     │    │
│  │  • Generate idempotency key                         │    │
│  │  • Respond immediately to caller                    │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: Process Asynchronously                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  • Mark as processing                               │    │
│  │  • Update workflow heartbeat                        │    │
│  │  • Execute business logic                           │    │
│  │  • Update workflow steps                            │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 3: Handle Result                           │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Success:                                           │    │
│  │  • Mark event/workflow as completed                 │    │
│  │  • Update order status                              │    │
│  │                                                      │    │
│  │  Failure:                                           │    │
│  │  • Mark event/workflow as failed                    │    │
│  │  • Create recovery record                           │    │
│  │  • Mark order as PENDING (not FAILED)               │    │
│  │  • Schedule retry                                   │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 4: Recovery (if needed)                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Recovery Worker (every 2 minutes):                 │    │
│  │  • Process pending webhook events                   │    │
│  │  • Retry failed events                              │    │
│  │  • Resume incomplete workflows                      │    │
│  │  • Recover stale workflows                          │    │
│  │  • Process vendor assignment timeouts               │    │
│  │  • Recover pending orders                           │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Database Tables

### 1. webhook_events
Stores all webhook events before processing.

**Columns**:
- `id`: Primary key
- `event_type`: Type of event (e.g., 'message_received')
- `source`: Source system (e.g., 'whatsapp')
- `payload`: Event data (JSONB)
- `headers`: HTTP headers (JSONB)
- `status`: pending, processing, completed, failed
- `retry_count`: Number of retry attempts
- `max_retries`: Maximum retries allowed (default: 3)
- `error_message`: Error details if failed
- `received_at`: When event was received
- `processed_at`: When processing completed

**Indexes**:
- `idx_webhook_events_status`: Fast lookup by status
- `idx_webhook_events_pending`: Pending events only
- `idx_webhook_events_failed`: Failed events for retry

### 2. workflow_states
Tracks workflow progress for crash recovery.

**Columns**:
- `id`: Primary key
- `workflow_type`: Type of workflow (e.g., 'order_creation', 'vendor_routing')
- `entity_type`: Entity being processed (e.g., 'order')
- `entity_id`: ID of entity
- `current_step`: Current workflow step
- `step_data`: Data needed to resume (JSONB)
- `status`: in_progress, completed, failed, paused
- `last_heartbeat`: Last activity timestamp
- `started_at`: Workflow start time
- `completed_at`: Workflow completion time

**Indexes**:
- `idx_workflow_states_status`: Fast lookup by status
- `idx_workflow_states_stale`: Detect stale workflows

### 3. vendor_assignment_retries
Tracks vendor assignment attempts with retry logic.

**Columns**:
- `id`: Primary key
- `order_id`: Order being assigned
- `vendor_id`: Vendor assigned to
- `routing_id`: Reference to routing record
- `attempt_number`: Current attempt (1-5)
- `max_attempts`: Maximum attempts (default: 5)
- `status`: pending, in_progress, success, failed, timeout
- `response_deadline`: When vendor must respond by
- `next_retry_at`: When to retry if timeout
- `failure_reason`: Why assignment failed

**Indexes**:
- `idx_vendor_assignment_order`: Lookup by order
- `idx_vendor_assignment_pending`: Pending retries

### 4. order_recovery_state
Tracks orders that need recovery after failures.

**Columns**:
- `id`: Primary key
- `order_id`: Order to recover (unique)
- `original_status`: Status before failure
- `recovery_status`: pending, in_progress, recovered, failed
- `failure_point`: Where failure occurred
- `failure_reason`: Why it failed
- `recovery_attempts`: Number of recovery attempts
- `max_recovery_attempts`: Maximum attempts (default: 5)
- `recovery_data`: Data needed for recovery (JSONB)

**Indexes**:
- `idx_order_recovery_status`: Fast lookup by status
- `idx_order_recovery_pending`: Pending recoveries

### 5. idempotency_keys
Prevents duplicate processing of operations.

**Columns**:
- `id`: Primary key
- `key`: Unique idempotency key
- `operation_type`: Type of operation
- `entity_type`: Entity type
- `entity_id`: Entity ID
- `request_payload`: Original request (JSONB)
- `response_payload`: Response to return (JSONB)
- `status`: processing, completed
- `expires_at`: When key expires (24 hours)

**Indexes**:
- `idx_idempotency_keys_key`: Fast lookup by key

## API Endpoints

### Recovery Dashboard
```
GET /api/v1/recovery/dashboard
```

Returns recovery statistics:
- Pending webhook events count
- Failed events needing retry
- Stuck events count
- Incomplete workflows count
- Pending order recoveries count

**Response**:
```json
{
  "success": true,
  "data": {
    "stats": [
      {
        "source": "webhook_events",
        "pending_count": 5,
        "retry_count": 2,
        "stuck_count": 0
      },
      {
        "source": "workflow_states",
        "pending_count": 3,
        "retry_count": 1,
        "stuck_count": 0
      }
    ]
  }
}
```

### Pending Webhook Events
```
GET /api/v1/recovery/webhook-events/pending?limit=50
```

### Failed Webhook Events
```
GET /api/v1/recovery/webhook-events/failed?limit=50
```

### Incomplete Workflows
```
GET /api/v1/recovery/workflows/incomplete?type=order_creation
```

### Pending Order Recoveries
```
GET /api/v1/recovery/orders/pending
```

### Vendor Assignment Retries
```
GET /api/v1/recovery/orders/:orderId/retries
```

### Manual Recovery Trigger
```
POST /api/v1/recovery/trigger
{
  "type": "all" // or "webhooks", "workflows", "orders"
}
```

### Cleanup Old Records
```
POST /api/v1/recovery/cleanup
```

## Recovery Worker

The recovery worker runs automatically:

### On Startup
- Waits 5 seconds for system to stabilize
- Processes all pending webhook events
- Resumes all incomplete workflows
- Recovers all stale workflows
- Processes timed out vendor assignments
- Recovers pending orders

### Every 2 Minutes
- Process pending webhook events
- Retry failed webhook events
- Recover stuck webhook events
- Resume incomplete workflows
- Recover stale workflows
- Process vendor assignment timeouts
- Recover pending orders

### Daily at 2 AM
- Cleanup completed webhook events (>7 days old)
- Cleanup completed workflows (>7 days old)
- Delete expired idempotency keys
- Delete old successful vendor assignments (>30 days)
- Delete recovered orders (>30 days)

## Usage Examples

### 1. Webhook Event Storage (WhatsApp)

```javascript
// In WhatsApp controller
const recoveryService = require('../services/failureRecovery.service');

async function webhook(req, res) {
  // CRITICAL: Store BEFORE processing
  const webhookEvent = await recoveryService.storeWebhookEvent(
    'whatsapp',
    'message_received',
    req.body,
    req.headers
  );

  // Respond immediately
  res.sendStatus(200);

  // Process asynchronously
  try {
    await recoveryService.markWebhookProcessing(webhookEvent.id);
    
    // Process message
    await processWhatsAppMessage(req.body);
    
    await recoveryService.markWebhookCompleted(webhookEvent.id);
  } catch (error) {
    await recoveryService.markWebhookFailed(webhookEvent.id, error);
  }
}
```

### 2. Workflow State Tracking (Order Creation)

```javascript
const recoveryService = require('../services/failureRecovery.service');

async function createOrder(orderData) {
  // Create workflow state
  const workflow = await recoveryService.createWorkflowState(
    'order_creation',
    'order',
    orderId,
    'validation',
    { orderData },
    5 // total steps
  );

  try {
    // Step 1: Validation
    await recoveryService.updateWorkflowHeartbeat(workflow.id);
    await validateOrder(orderData);
    
    // Step 2: Inventory check
    await recoveryService.updateWorkflowStep(workflow.id, 'inventory_check', {});
    await recoveryService.updateWorkflowHeartbeat(workflow.id);
    await checkInventory(orderData);
    
    // Step 3: Vendor routing
    await recoveryService.updateWorkflowStep(workflow.id, 'vendor_routing', {});
    await recoveryService.updateWorkflowHeartbeat(workflow.id);
    await routeToVendor(orderId);
    
    // Step 4: Payment processing
    await recoveryService.updateWorkflowStep(workflow.id, 'payment', {});
    await recoveryService.updateWorkflowHeartbeat(workflow.id);
    await processPayment(orderId);
    
    // Step 5: Confirmation
    await recoveryService.updateWorkflowStep(workflow.id, 'confirmation', {});
    await sendConfirmation(orderId);
    
    // Complete workflow
    await recoveryService.completeWorkflow(workflow.id);
  } catch (error) {
    await recoveryService.failWorkflow(workflow.id, error);
    
    // Create order recovery
    await recoveryService.createOrderRecoveryState(
      orderId,
      'PENDING',
      workflow.current_step,
      error.message,
      workflow.step_data
    );
  }
}
```

### 3. Vendor Assignment with Retry

```javascript
const orderRoutingWithRecovery = require('../services/orderRoutingWithRecovery.service');

// Route order with automatic retry
const result = await orderRoutingWithRecovery.routeOrderWithRecovery(
  orderId,
  orderData
);

// If vendor doesn't respond within 2 hours, automatically routes to next vendor
// If all vendors timeout, order marked as PENDING for manual review
```

### 4. Idempotency

```javascript
const recoveryService = require('../services/failureRecovery.service');

async function createPayment(paymentData, idempotencyKey) {
  // Check if already processed
  const existing = await recoveryService.checkIdempotencyKey(idempotencyKey);
  if (existing && existing.status === 'completed') {
    return existing.response_payload;
  }

  // Create idempotency key
  await recoveryService.createIdempotencyKey(
    idempotencyKey,
    'create_payment',
    paymentData
  );

  // Process payment
  const result = await processPayment(paymentData);

  // Store result
  await recoveryService.completeIdempotencyKey(idempotencyKey, result);

  return result;
}
```

## Monitoring

### Check Recovery Dashboard
```bash
curl http://localhost:3000/api/v1/recovery/dashboard \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Check Pending Recoveries
```sql
-- Pending webhook events
SELECT COUNT(*) FROM webhook_events WHERE status = 'pending';

-- Incomplete workflows
SELECT COUNT(*) FROM workflow_states WHERE status = 'in_progress';

-- Pending order recoveries
SELECT COUNT(*) FROM order_recovery_state WHERE recovery_status = 'pending';

-- Timed out vendor assignments
SELECT COUNT(*) FROM vendor_assignment_retries 
WHERE status IN ('pending', 'in_progress') 
AND response_deadline < CURRENT_TIMESTAMP;
```

### View Recovery Dashboard
```sql
SELECT * FROM recovery_dashboard;
```

## Troubleshooting

### Orders Stuck in PENDING
1. Check recovery dashboard: `GET /api/v1/recovery/dashboard`
2. View pending recoveries: `GET /api/v1/recovery/orders/pending`
3. Manually trigger recovery: `POST /api/v1/recovery/trigger`

### Webhook Events Not Processing
1. Check pending events: `GET /api/v1/recovery/webhook-events/pending`
2. Check failed events: `GET /api/v1/recovery/webhook-events/failed`
3. Manually trigger recovery: `POST /api/v1/recovery/trigger`

### Workflows Not Resuming
1. Check incomplete workflows: `GET /api/v1/recovery/workflows/incomplete`
2. Check for stale workflows: `SELECT * FROM workflow_states WHERE last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '5 minutes'`
3. Manually trigger recovery: `POST /api/v1/recovery/trigger`

### Vendor Assignments Timing Out
1. Check vendor retries: `GET /api/v1/recovery/orders/:orderId/retries`
2. Verify response deadline: `SELECT * FROM vendor_assignment_retries WHERE order_id = :orderId`
3. Manually route to next vendor if needed

## Performance Impact

### Storage Overhead
- Webhook events: ~1KB per event
- Workflow states: ~500 bytes per workflow
- Vendor retries: ~200 bytes per attempt
- Order recovery: ~500 bytes per order

### Processing Overhead
- Webhook storage: <5ms
- Workflow state creation: <10ms
- Recovery worker: Runs every 2 minutes, typically <1 second

### Cleanup
- Automatic cleanup runs daily at 2 AM
- Removes records older than retention period
- Minimal impact on performance

## Best Practices

1. **Always Store Before Processing**: Store webhook events and create workflow states BEFORE processing
2. **Update Heartbeats**: Update workflow heartbeats regularly during long operations
3. **Use Idempotency Keys**: Use idempotency keys for critical operations
4. **Mark Orders as PENDING**: Never mark orders as FAILED, always PENDING for recovery
5. **Monitor Recovery Dashboard**: Check dashboard regularly for stuck operations
6. **Test Recovery**: Regularly test crash recovery by killing server during processing

## Configuration

### Environment Variables
```env
# Recovery settings
RECOVERY_WEBHOOK_MAX_RETRIES=3
RECOVERY_WORKFLOW_TIMEOUT_MINUTES=5
RECOVERY_VENDOR_RESPONSE_DEADLINE_HOURS=2
RECOVERY_MAX_VENDOR_ATTEMPTS=5
RECOVERY_MAX_ORDER_RECOVERY_ATTEMPTS=5
RECOVERY_WORKER_INTERVAL_MINUTES=2
RECOVERY_CLEANUP_RETENTION_DAYS=7
```

## Migration

Apply the failure recovery migration:
```bash
Get-Content "prisma/migrations/013_failure_recovery.sql" | docker exec -i postgres-khaacho psql -U postgres -d khaacho
```

## Summary

The Failure Recovery System ensures:
- ✅ **Zero Data Loss**: All events stored before processing
- ✅ **Automatic Recovery**: Crashed workflows resume automatically
- ✅ **Vendor Retry**: Automatic fallback to next vendor
- ✅ **No Failed Orders**: Orders marked as PENDING, never FAILED
- ✅ **Idempotency**: Safe retries without duplicates
- ✅ **Monitoring**: Complete visibility into recovery status
- ✅ **Cleanup**: Automatic cleanup of old records

**Result**: No order is ever lost, even if server crashes during processing.
