# Failure Recovery Implementation Summary

## What Was Implemented

### 1. Database Migration (013_failure_recovery.sql) ✅
Created 5 new tables for comprehensive failure recovery:

- **webhook_events**: Store all webhook events before processing
- **workflow_states**: Track workflow progress with heartbeat monitoring
- **vendor_assignment_retries**: Track vendor assignment attempts with automatic retry
- **order_recovery_state**: Track orders needing recovery
- **idempotency_keys**: Prevent duplicate processing

**Features**:
- 15+ indexes for fast lookups
- Automatic timestamp updates via triggers
- Recovery dashboard view for monitoring
- Cleanup function for old records

### 2. Failure Recovery Service ✅
**File**: `src/services/failureRecovery.service.js`

**Functions** (30+ functions):
- Webhook event storage and processing
- Workflow state management with heartbeat
- Vendor assignment retry tracking
- Order recovery state management
- Idempotency key handling
- Recovery dashboard stats
- Automatic cleanup

### 3. Recovery Worker ✅
**File**: `src/workers/recovery.worker.js`

**Capabilities**:
- **On Startup**: Automatic recovery of all pending operations
- **Every 2 Minutes**: Process pending/failed events, resume workflows, handle timeouts
- **Daily at 2 AM**: Cleanup old records

**Recovery Tasks**:
- Process pending webhook events
- Retry failed webhook events
- Recover stuck webhook events
- Resume incomplete workflows
- Recover stale workflows
- Process vendor assignment timeouts
- Recover pending orders

### 4. Enhanced Order Routing with Recovery ✅
**File**: `src/services/orderRoutingWithRecovery.service.js`

**Features**:
- Workflow state tracking for routing
- Automatic vendor assignment retry
- Route to next best vendor on timeout/rejection
- Up to 5 vendor assignment attempts
- Orders marked as PENDING (never FAILED)
- Automatic recovery after max attempts

### 5. Updated WhatsApp Controller ✅
**File**: `src/controllers/whatsapp.controller.js`

**Changes**:
- Store webhook event BEFORE processing
- Immediate response to WhatsApp (prevent timeout)
- Asynchronous processing via job queue
- Automatic retry on failure
- Zero data loss guarantee

### 6. Recovery Controller & Routes ✅
**Files**: 
- `src/controllers/recovery.controller.js`
- `src/routes/recovery.routes.js`

**Endpoints**:
- `GET /api/v1/recovery/dashboard` - Recovery statistics
- `GET /api/v1/recovery/webhook-events/pending` - Pending events
- `GET /api/v1/recovery/webhook-events/failed` - Failed events
- `GET /api/v1/recovery/workflows/incomplete` - Incomplete workflows
- `GET /api/v1/recovery/orders/pending` - Pending recoveries
- `GET /api/v1/recovery/orders/:orderId/retries` - Vendor retries
- `POST /api/v1/recovery/trigger` - Manual recovery trigger
- `POST /api/v1/recovery/cleanup` - Manual cleanup

### 7. Server Integration ✅
**File**: `src/server.js`

**Changes**:
- Initialize recovery worker on startup
- Automatic crash recovery after restart
- Graceful shutdown handling

### 8. Documentation ✅
**Files**:
- `FAILURE_RECOVERY_SYSTEM.md` - Complete system documentation
- `FAILURE_RECOVERY_IMPLEMENTATION.md` - This file
- `test-failure-recovery.js` - Test script

---

## Key Features

### Zero Data Loss ✅
- All webhook events stored in database BEFORE processing
- If server crashes, events are automatically processed on restart
- No webhook event is ever lost

### Automatic Retry ✅
- Failed webhook events retried up to 3 times
- Failed workflows automatically resumed
- Vendor assignments retried up to 5 times
- Exponential backoff for retries

### Vendor Assignment Retry ✅
- If vendor doesn't respond within 2 hours, automatically route to next vendor
- Up to 5 vendor assignment attempts per order
- Orders marked as PENDING during retry (never FAILED)
- Automatic fallback to next best vendor

### Workflow Resumption ✅
- All workflows tracked with step-by-step progress
- Heartbeat monitoring detects crashed workflows
- Workflows automatically resume from last checkpoint
- No duplicate processing

### Order Recovery ✅
- Orders never marked as FAILED, always PENDING
- Exact failure point recorded
- Automatic recovery every 2 minutes
- Manual recovery trigger available

### Idempotency ✅
- Prevents duplicate processing
- 24-hour idempotency window
- Safe retries return same result

---

## How It Works

### 1. Webhook Event Flow

```
Webhook Received
    ↓
Store in Database (webhook_events table)
    ↓
Respond 200 OK Immediately
    ↓
Process Asynchronously
    ↓
Success → Mark Completed
Failure → Mark Failed → Retry Later
```

### 2. Workflow Flow

```
Start Workflow
    ↓
Create Workflow State
    ↓
Execute Step 1 → Update Heartbeat → Update Step
    ↓
Execute Step 2 → Update Heartbeat → Update Step
    ↓
Execute Step 3 → Update Heartbeat → Update Step
    ↓
Success → Complete Workflow
Failure → Fail Workflow → Create Recovery Record
```

### 3. Vendor Assignment Flow

```
Route Order to Vendor
    ↓
Create Assignment Retry Record
    ↓
Set 2-Hour Deadline
    ↓
Wait for Vendor Response
    ↓
Accepted → Update Order Status
Rejected → Route to Next Vendor
Timeout → Route to Next Vendor
Max Attempts → Create Recovery Record
```

### 4. Recovery Flow

```
Server Starts
    ↓
Wait 5 Seconds
    ↓
Process All Pending Webhook Events
Resume All Incomplete Workflows
Recover All Stale Workflows
Process All Timed Out Assignments
Recover All Pending Orders
    ↓
Continue Normal Operation
    ↓
Every 2 Minutes: Run Recovery Tasks
```

---

## Testing

### Apply Migration
```powershell
Get-Content "prisma/migrations/013_failure_recovery.sql" | docker exec -i postgres-khaacho psql -U postgres -d khaacho
```

### Run Test Script
```bash
node test-failure-recovery.js
```

### Manual Testing

1. **Test Webhook Storage**:
   - Send WhatsApp webhook
   - Check `webhook_events` table
   - Verify event stored before processing

2. **Test Crash Recovery**:
   - Start processing an order
   - Kill server (Ctrl+C)
   - Restart server
   - Verify order processing resumes

3. **Test Vendor Timeout**:
   - Route order to vendor
   - Wait 2+ hours without response
   - Verify automatic routing to next vendor

4. **Test Recovery Dashboard**:
   ```bash
   curl http://localhost:3000/api/v1/recovery/dashboard \
     -H "Authorization: Bearer ADMIN_TOKEN"
   ```

---

## Monitoring

### Check Recovery Status
```sql
-- Recovery dashboard
SELECT * FROM recovery_dashboard;

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

### API Monitoring
```bash
# Recovery dashboard
GET /api/v1/recovery/dashboard

# Pending operations
GET /api/v1/recovery/webhook-events/pending
GET /api/v1/recovery/workflows/incomplete
GET /api/v1/recovery/orders/pending
```

---

## Configuration

### Environment Variables (Optional)
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

---

## Files Created

### Database
- `prisma/migrations/013_failure_recovery.sql` - Migration with 5 tables

### Services
- `src/services/failureRecovery.service.js` - Core recovery service (30+ functions)
- `src/services/orderRoutingWithRecovery.service.js` - Enhanced routing with retry

### Workers
- `src/workers/recovery.worker.js` - Automatic recovery worker

### Controllers & Routes
- `src/controllers/recovery.controller.js` - Recovery API controller
- `src/routes/recovery.routes.js` - Recovery API routes

### Documentation
- `FAILURE_RECOVERY_SYSTEM.md` - Complete documentation
- `FAILURE_RECOVERY_IMPLEMENTATION.md` - This file
- `test-failure-recovery.js` - Test script

### Updated Files
- `src/controllers/whatsapp.controller.js` - Added webhook storage
- `src/routes/index.js` - Added recovery routes
- `src/server.js` - Added recovery worker initialization

---

## Next Steps

1. **Apply Migration**:
   ```powershell
   Get-Content "prisma/migrations/013_failure_recovery.sql" | docker exec -i postgres-khaacho psql -U postgres -d khaacho
   ```

2. **Restart Server**:
   ```bash
   npm start
   ```

3. **Verify Recovery Worker**:
   - Check logs for "Recovery worker initialized"
   - Check logs for "Running startup recovery"

4. **Test Recovery**:
   ```bash
   node test-failure-recovery.js
   ```

5. **Monitor Dashboard**:
   ```bash
   curl http://localhost:3000/api/v1/recovery/dashboard \
     -H "Authorization: Bearer ADMIN_TOKEN"
   ```

---

## Success Criteria

- [x] All webhook events stored before processing
- [x] Automatic recovery on server restart
- [x] Vendor assignment retry (up to 5 attempts)
- [x] Orders marked as PENDING (never FAILED)
- [x] Workflow resumption from last checkpoint
- [x] Idempotency for safe retries
- [x] Recovery dashboard for monitoring
- [x] Automatic cleanup of old records
- [x] Complete documentation
- [x] Test script provided

---

## Summary

The Failure Recovery System ensures **zero data loss** and **automatic recovery** from any failure:

✅ **Webhook Events**: Stored before processing, never lost
✅ **Workflows**: Resume from exact point of failure
✅ **Vendor Assignments**: Automatic retry with fallback
✅ **Orders**: Never marked as FAILED, always recoverable
✅ **Monitoring**: Complete visibility into recovery status
✅ **Cleanup**: Automatic cleanup of old records

**Result**: No order is ever lost, even if server crashes during processing.
