# Monitoring System Deployment Checklist

## Pre-Deployment

### ✅ Code Review
- [x] Monitoring service implemented
- [x] Alerting service implemented
- [x] Middleware created
- [x] Controller and routes added
- [x] All services integrated
- [x] All queue processors updated
- [x] No syntax errors or diagnostics

### ✅ Documentation
- [x] Comprehensive system documentation
- [x] Implementation summary
- [x] API documentation
- [x] Test script created

## Deployment Steps

### Step 1: Backup Current System

```powershell
# Backup database
docker exec whatsapp_postgres pg_dump -U postgres khaacho_db > backup_before_monitoring_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql

# Backup .env file
Copy-Item .env .env.backup
```

**Status:** ⬜ Not Started

---

### Step 2: Update Environment Variables

Add these to `.env`:

```env
# Monitoring Thresholds
MONITORING_ORDER_RATE_THRESHOLD=100
MONITORING_JOB_FAILURE_THRESHOLD=10
MONITORING_WHATSAPP_FAILURE_THRESHOLD=20
MONITORING_API_ERROR_THRESHOLD=5
MONITORING_DB_LATENCY_THRESHOLD=1000
MONITORING_CPU_THRESHOLD=80
MONITORING_MEMORY_THRESHOLD=80
MONITORING_DISK_THRESHOLD=85

# Alert Configuration
MONITORING_ALERT_COOLDOWN=300000
MONITORING_ENABLE_EMAIL_ALERTS=true
MONITORING_ENABLE_SMS_ALERTS=false
MONITORING_ENABLE_WEBHOOK_ALERTS=false
MONITORING_ALERT_WEBHOOK_URL=

# Notification Channels
ALERT_EMAIL_FROM=alerts@khaacho.com
ALERT_EMAIL_TO=admin@khaacho.com
ALERT_SMS_PHONE=
```

**Status:** ⬜ Not Started

---

### Step 3: Apply Database Migration

```powershell
# Apply migration 014
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db < prisma/migrations/014_monitoring_alerting.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE VIEW
CREATE VIEW
```

**Verification:**
```powershell
# Verify tables created
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db -c "\dt system_*"
```

**Expected Output:**
```
 Schema |      Name       | Type  |  Owner
--------+-----------------+-------+----------
 public | system_alerts   | table | postgres
 public | system_metrics  | table | postgres
```

**Status:** ⬜ Not Started

---

### Step 4: Restart Server

```powershell
# Stop current server (if running)
# Press Ctrl+C in server terminal

# Start server
npm start
```

**Expected Output:**
```
Khaacho platform running on port 3000
Environment: development
Admin panel: http://localhost:3000/admin
Job queue system initialized
Credit score worker initialized
Risk control worker initialized
Order routing worker initialized
Vendor performance worker initialized
Price intelligence worker initialized
Recovery worker initialized - crash recovery enabled
System metrics collection started
```

**Status:** ⬜ Not Started

---

### Step 5: Verify Health Endpoint

```powershell
# Test health endpoint (no auth required)
curl http://localhost:3000/api/v1/monitoring/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-08T...",
  "uptime": 10,
  "database": "connected",
  "redis": "connected",
  "memory": {
    "used": 512,
    "total": 2048,
    "percentage": 25
  }
}
```

**Status:** ⬜ Not Started

---

### Step 6: Test Monitoring Endpoints

```powershell
# Get admin token first
# Login to admin panel and copy token from browser storage

# Test metrics endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/metrics

# Test dashboard endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/dashboard

# Test alerts endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/alerts
```

**Status:** ⬜ Not Started

---

### Step 7: Run Test Script

```powershell
# Update admin token in test-monitoring.js
# Edit line 6: const ADMIN_TOKEN = 'your-actual-token';

# Run tests
node test-monitoring.js
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║     MONITORING AND ALERTING SYSTEM TEST SUITE             ║
╚════════════════════════════════════════════════════════════╝

============================================================
TEST 1: System Health Check
============================================================

✓ Health check successful
...

============================================================
TEST SUMMARY
============================================================

Total Tests: 7
Passed: 7
Success Rate: 100.0%

✓ All tests passed! Monitoring system is working correctly.
```

**Status:** ⬜ Not Started

---

### Step 8: Verify Automatic Tracking

#### Test Order Tracking

```powershell
# Create a test order via API or admin panel
# Check if order metric increased

curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/metrics
```

**Verify:** `orders.today` should increment

**Status:** ⬜ Not Started

#### Test WhatsApp Tracking

```powershell
# Send a test WhatsApp message
# Check if WhatsApp metric increased

curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/metrics
```

**Verify:** `whatsapp.total` should increment

**Status:** ⬜ Not Started

#### Test Job Tracking

```powershell
# Trigger a job (e.g., credit score calculation)
# Check if job metric increased

curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/metrics
```

**Verify:** `jobs.total` should increment

**Status:** ⬜ Not Started

---

### Step 9: Test Alert System

#### Trigger Test Alert

```powershell
# Temporarily lower threshold to trigger alert
# Edit .env: MONITORING_ORDER_RATE_THRESHOLD=1

# Restart server
# Create 2-3 orders quickly

# Check for alert
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/alerts
```

**Verify:** Alert should be created with type `HIGH_ORDER_CREATION_RATE`

**Status:** ⬜ Not Started

#### Test Alert Acknowledgement

```powershell
# Get alert ID from previous step
$alertId = "uuid-from-previous-step"

# Acknowledge alert
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{\"acknowledgedBy\":\"admin\",\"notes\":\"Test\"}' http://localhost:3000/api/v1/monitoring/alerts/$alertId/acknowledge
```

**Verify:** Alert status should change to `ACKNOWLEDGED`

**Status:** ⬜ Not Started

#### Test Alert Resolution

```powershell
# Resolve alert
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{\"resolvedBy\":\"admin\",\"resolution\":\"Test complete\"}' http://localhost:3000/api/v1/monitoring/alerts/$alertId/resolve
```

**Verify:** Alert status should change to `RESOLVED`

**Status:** ⬜ Not Started

---

### Step 10: Monitor System Metrics

```powershell
# Wait 2-3 minutes for system metrics to be collected
Start-Sleep -Seconds 180

# Check system metrics
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/v1/monitoring/system-metrics
```

**Verify:** Should return CPU, memory, disk metrics

**Status:** ⬜ Not Started

---

### Step 11: Check Logs

```powershell
# Check for monitoring-related logs
Get-Content logs/combined-$(Get-Date -Format 'yyyy-MM-dd').log | Select-String "monitoring"

# Check for any errors
Get-Content logs/error-$(Get-Date -Format 'yyyy-MM-dd').log | Select-String "monitoring"
```

**Verify:** No errors related to monitoring

**Status:** ⬜ Not Started

---

### Step 12: Restore Thresholds

```powershell
# Restore original threshold values in .env
# MONITORING_ORDER_RATE_THRESHOLD=100

# Restart server
npm start
```

**Status:** ⬜ Not Started

---

## Post-Deployment Verification

### ✅ Functionality Checks

- [ ] Health endpoint accessible
- [ ] Metrics endpoint returns data
- [ ] Dashboard endpoint returns data
- [ ] Alerts endpoint returns data
- [ ] System metrics being collected
- [ ] Order tracking working
- [ ] Job tracking working
- [ ] WhatsApp tracking working
- [ ] API tracking working
- [ ] Database tracking working
- [ ] Alerts can be created
- [ ] Alerts can be acknowledged
- [ ] Alerts can be resolved
- [ ] No errors in logs

### ✅ Performance Checks

- [ ] Server startup time acceptable
- [ ] API response times normal
- [ ] No memory leaks detected
- [ ] CPU usage normal
- [ ] Database performance normal

### ✅ Integration Checks

- [ ] Order creation still works
- [ ] WhatsApp messages still send
- [ ] Job queues still process
- [ ] Admin panel still accessible
- [ ] All existing features working

## Rollback Plan

If issues occur, follow these steps:

### 1. Stop Server
```powershell
# Press Ctrl+C in server terminal
```

### 2. Restore Environment
```powershell
# Restore .env backup
Copy-Item .env.backup .env
```

### 3. Rollback Database
```powershell
# Drop monitoring tables
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db -c "DROP TABLE IF EXISTS notifications CASCADE;"
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db -c "DROP TABLE IF EXISTS system_alerts CASCADE;"
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db -c "DROP TABLE IF EXISTS system_metrics CASCADE;"
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db -c "DROP VIEW IF EXISTS active_alerts_summary CASCADE;"
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db -c "DROP VIEW IF EXISTS system_health_metrics CASCADE;"
```

### 4. Revert Code Changes
```powershell
# Use git to revert changes
git checkout HEAD -- src/server.js
git checkout HEAD -- src/services/order.service.js
git checkout HEAD -- src/services/whatsapp.service.js
git checkout HEAD -- src/queues/processors/
```

### 5. Restart Server
```powershell
npm start
```

## Success Criteria

✅ All deployment steps completed without errors  
✅ All functionality checks passed  
✅ All performance checks passed  
✅ All integration checks passed  
✅ Test script shows 100% success rate  
✅ No errors in application logs  
✅ System running stable for 24 hours  

## Notes

- **Estimated Deployment Time:** 30-45 minutes
- **Downtime Required:** 2-3 minutes (server restart)
- **Risk Level:** Low (non-breaking changes, graceful error handling)
- **Rollback Time:** 5-10 minutes if needed

## Support Contacts

- **Technical Issues:** Check logs and documentation
- **Database Issues:** Review migration script
- **API Issues:** Test with curl commands
- **General Questions:** Refer to MONITORING_ALERTING_SYSTEM.md

## Completion

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Verification By:** _______________  
**Status:** ⬜ Success / ⬜ Partial / ⬜ Rollback Required  

**Notes:**
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
