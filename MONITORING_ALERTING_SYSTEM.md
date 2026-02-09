# Monitoring and Alerting System

## Overview

The Khaacho platform includes a comprehensive monitoring and alerting system that tracks system health, performance metrics, and automatically triggers alerts when thresholds are exceeded.

## Features

### 1. Real-Time Metrics Tracking
- **Order Creation Rate**: Tracks orders created per minute
- **Job Queue Performance**: Monitors job completion rates and failures
- **WhatsApp Delivery**: Tracks message success/failure rates
- **API Performance**: Monitors response times and error rates
- **Database Latency**: Tracks query execution times
- **System Resources**: CPU, memory, and disk usage

### 2. Automatic Alerting
- **Threshold-Based Alerts**: Automatically triggers when metrics exceed configured thresholds
- **Alert Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL
- **Alert Cooldown**: Prevents alert spam with configurable cooldown periods
- **Multi-Channel Notifications**: Email, SMS, Webhook, In-App

### 3. Admin Dashboard
- System health overview
- Active alerts summary
- Real-time metrics visualization
- Threshold status monitoring

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring System                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Metrics    │  │   Alerting   │  │  Dashboard   │      │
│  │  Collection  │─▶│    Engine    │─▶│   Display    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                                 │
│         ▼                  ▼                                 │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Database   │  │ Notification │                        │
│  │   Storage    │  │   Service    │                        │
│  └──────────────┘  └──────────────┘                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Metrics Collection**
   - Services call `monitoringService.trackXXX()` methods
   - Middleware automatically tracks API requests and database queries
   - System metrics collected every 60 seconds

2. **Threshold Checking**
   - Metrics compared against configured thresholds
   - Alerts triggered when thresholds exceeded
   - Cooldown prevents duplicate alerts

3. **Alert Notification**
   - Alerts stored in database
   - Notifications sent via configured channels
   - Admin dashboard updated in real-time

## Database Schema

### system_metrics
Stores system resource metrics (CPU, memory, disk).

```sql
CREATE TABLE system_metrics (
  id UUID PRIMARY KEY,
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(5,2),
  disk_usage DECIMAL(5,2),
  active_connections INTEGER,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### system_alerts
Stores all system alerts.

```sql
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY,
  alert_type VARCHAR(50),
  severity VARCHAR(20),
  message TEXT,
  metadata JSONB,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### notifications
Stores notification delivery records.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES system_alerts(id),
  channel VARCHAR(20),
  recipient VARCHAR(255),
  status VARCHAR(20),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

### Environment Variables

```env
# Monitoring Thresholds
MONITORING_ORDER_RATE_THRESHOLD=100          # Orders per minute
MONITORING_JOB_FAILURE_THRESHOLD=10          # Failed jobs per hour
MONITORING_WHATSAPP_FAILURE_THRESHOLD=20     # Failed messages per hour
MONITORING_API_ERROR_THRESHOLD=5             # Error rate percentage
MONITORING_DB_LATENCY_THRESHOLD=1000         # Milliseconds
MONITORING_CPU_THRESHOLD=80                  # Percentage
MONITORING_MEMORY_THRESHOLD=80               # Percentage
MONITORING_DISK_THRESHOLD=85                 # Percentage

# Alert Configuration
MONITORING_ALERT_COOLDOWN=300000             # 5 minutes in milliseconds
MONITORING_ENABLE_EMAIL_ALERTS=true
MONITORING_ENABLE_SMS_ALERTS=false
MONITORING_ENABLE_WEBHOOK_ALERTS=true
MONITORING_ALERT_WEBHOOK_URL=https://your-webhook-url.com

# Notification Channels
ALERT_EMAIL_FROM=alerts@khaacho.com
ALERT_EMAIL_TO=admin@khaacho.com
ALERT_SMS_PHONE=+977-XXXXXXXXXX
```

### Threshold Configuration

Thresholds can be adjusted in `src/services/monitoring.service.js`:

```javascript
this.thresholds = {
  orderCreationRate: parseInt(process.env.MONITORING_ORDER_RATE_THRESHOLD) || 100,
  jobFailureRate: parseInt(process.env.MONITORING_JOB_FAILURE_THRESHOLD) || 10,
  whatsappFailureRate: parseInt(process.env.MONITORING_WHATSAPP_FAILURE_THRESHOLD) || 20,
  apiErrorRate: parseFloat(process.env.MONITORING_API_ERROR_THRESHOLD) || 5.0,
  databaseLatency: parseInt(process.env.MONITORING_DB_LATENCY_THRESHOLD) || 1000,
  cpuUsage: parseInt(process.env.MONITORING_CPU_THRESHOLD) || 80,
  memoryUsage: parseInt(process.env.MONITORING_MEMORY_THRESHOLD) || 80,
  diskUsage: parseInt(process.env.MONITORING_DISK_THRESHOLD) || 85,
};
```

## API Endpoints

### Public Endpoints

#### GET /api/v1/monitoring/health
Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-08T10:30:00Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected",
  "memory": {
    "used": 512,
    "total": 2048,
    "percentage": 25
  }
}
```

### Admin Endpoints (Authentication Required)

#### GET /api/v1/monitoring/metrics
Get current system metrics.

**Response:**
```json
{
  "orders": {
    "total": 1250,
    "today": 45,
    "creationRate": 12.5
  },
  "jobs": {
    "total": 3500,
    "completed": 3450,
    "failed": 50,
    "successRate": 98.57
  },
  "whatsapp": {
    "total": 2800,
    "sent": 2750,
    "failed": 50,
    "successRate": 98.21
  },
  "api": {
    "totalRequests": 15000,
    "errorRate": 2.5,
    "avgResponseTime": 145
  },
  "database": {
    "avgLatency": 25,
    "slowQueries": 3
  }
}
```

#### GET /api/v1/monitoring/alerts
Get active alerts.

**Query Parameters:**
- `status`: Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)
- `severity`: Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "alertType": "HIGH_JOB_FAILURE_RATE",
      "severity": "HIGH",
      "message": "Job failure rate exceeded threshold",
      "metadata": {
        "current": 15,
        "threshold": 10
      },
      "status": "ACTIVE",
      "createdAt": "2026-02-08T10:25:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

#### GET /api/v1/monitoring/dashboard
Get monitoring dashboard data.

**Response:**
```json
{
  "health": {
    "status": "healthy",
    "uptime": 3600
  },
  "alerts": {
    "active": 2,
    "critical": 0
  },
  "metrics": {
    "orders": { "today": 45, "creationRate": 12.5 },
    "jobs": { "successRate": 98.57 },
    "whatsapp": { "successRate": 98.21 },
    "api": { "errorRate": 2.5 }
  },
  "thresholds": {
    "orderCreationRate": {
      "current": 12.5,
      "threshold": 100,
      "exceeded": false
    },
    "jobFailureRate": {
      "current": 15,
      "threshold": 10,
      "exceeded": true
    }
  }
}
```

#### GET /api/v1/monitoring/system-metrics
Get system resource metrics (CPU, memory, disk).

**Query Parameters:**
- `hours`: Number of hours to retrieve (default: 24)

**Response:**
```json
{
  "metrics": [
    {
      "id": "uuid",
      "cpuUsage": 45.5,
      "memoryUsage": 62.3,
      "diskUsage": 55.0,
      "activeConnections": 25,
      "timestamp": "2026-02-08T10:30:00Z"
    }
  ]
}
```

#### POST /api/v1/monitoring/alerts/:id/acknowledge
Acknowledge an alert.

**Request Body:**
```json
{
  "acknowledgedBy": "admin@khaacho.com",
  "notes": "Investigating the issue"
}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "uuid",
    "status": "ACKNOWLEDGED",
    "acknowledgedBy": "admin@khaacho.com",
    "acknowledgedAt": "2026-02-08T10:35:00Z"
  }
}
```

#### POST /api/v1/monitoring/alerts/:id/resolve
Resolve an alert.

**Request Body:**
```json
{
  "resolvedBy": "admin@khaacho.com",
  "resolution": "Increased server resources, issue resolved"
}
```

**Response:**
```json
{
  "success": true,
  "alert": {
    "id": "uuid",
    "status": "RESOLVED",
    "resolvedBy": "admin@khaacho.com",
    "resolvedAt": "2026-02-08T10:40:00Z",
    "resolution": "Increased server resources, issue resolved"
  }
}
```

## Integration Guide

### Tracking Order Creation

```javascript
const monitoringService = require('./services/monitoring.service');

async function createOrder(orderData) {
  const order = await prisma.order.create({ data: orderData });
  
  // Track order creation
  await monitoringService.trackOrderCreated(
    order.id,
    order.retailerId,
    order.vendorId,
    order.total
  );
  
  return order;
}
```

### Tracking Job Completion

```javascript
const monitoringService = require('../../services/monitoring.service');

async function jobProcessor(job) {
  try {
    // Process job
    const result = await processJob(job);
    
    // Track success
    await monitoringService.trackJobCompleted(
      'job-type',
      job.id,
      true
    );
    
    return result;
  } catch (error) {
    // Track failure
    await monitoringService.trackJobCompleted(
      'job-type',
      job.id,
      false,
      error.message
    );
    
    throw error;
  }
}
```

### Tracking WhatsApp Messages

```javascript
const monitoringService = require('./services/monitoring.service');

async function sendWhatsAppMessage(to, message) {
  const startTime = Date.now();
  
  try {
    await whatsappAPI.send(to, message);
    const duration = Date.now() - startTime;
    
    // Track success
    await monitoringService.trackWhatsAppMessage(to, 'sent', duration);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Track failure
    await monitoringService.trackWhatsAppMessage(to, 'failed', duration);
    
    throw error;
  }
}
```

## Alert Types

### HIGH_ORDER_CREATION_RATE
**Severity:** MEDIUM  
**Trigger:** Order creation rate exceeds threshold  
**Action:** Monitor system resources, consider scaling

### HIGH_JOB_FAILURE_RATE
**Severity:** HIGH  
**Trigger:** Job failure rate exceeds threshold  
**Action:** Check job queue logs, investigate failures

### HIGH_WHATSAPP_FAILURE_RATE
**Severity:** HIGH  
**Trigger:** WhatsApp message failure rate exceeds threshold  
**Action:** Check WhatsApp API status, verify credentials

### HIGH_API_ERROR_RATE
**Severity:** CRITICAL  
**Trigger:** API error rate exceeds threshold  
**Action:** Check application logs, investigate errors

### HIGH_DATABASE_LATENCY
**Severity:** HIGH  
**Trigger:** Database query latency exceeds threshold  
**Action:** Check database performance, optimize queries

### HIGH_CPU_USAGE
**Severity:** HIGH  
**Trigger:** CPU usage exceeds threshold  
**Action:** Scale server resources, optimize code

### HIGH_MEMORY_USAGE
**Severity:** HIGH  
**Trigger:** Memory usage exceeds threshold  
**Action:** Check for memory leaks, scale resources

### HIGH_DISK_USAGE
**Severity:** CRITICAL  
**Trigger:** Disk usage exceeds threshold  
**Action:** Clean up logs, archive old data, expand storage

## Testing

### Apply Migration

```powershell
# Apply monitoring migration
docker exec -i whatsapp_postgres psql -U postgres -d khaacho_db < prisma/migrations/014_monitoring_alerting.sql
```

### Run Test Script

```bash
# Update admin token in test-monitoring.js
# Then run:
node test-monitoring.js
```

### Manual Testing

```bash
# Check health
curl http://localhost:3000/api/v1/monitoring/health

# Get metrics (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/monitoring/metrics

# Get dashboard
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/monitoring/dashboard
```

## Best Practices

### 1. Alert Management
- Acknowledge alerts promptly
- Document resolution steps
- Review alert history regularly
- Adjust thresholds based on actual usage

### 2. Performance Monitoring
- Monitor trends over time
- Set up automated reports
- Correlate metrics with business events
- Use metrics for capacity planning

### 3. Incident Response
- Define escalation procedures
- Document common issues and solutions
- Set up on-call rotation
- Conduct post-incident reviews

### 4. Threshold Tuning
- Start with conservative thresholds
- Adjust based on false positive rate
- Consider time-of-day variations
- Review thresholds quarterly

## Troubleshooting

### No Metrics Appearing

**Problem:** Dashboard shows no metrics  
**Solution:**
1. Check if monitoring middleware is enabled in `server.js`
2. Verify database connection
3. Check if system metrics collection is running
4. Review application logs for errors

### Alerts Not Triggering

**Problem:** Thresholds exceeded but no alerts  
**Solution:**
1. Verify alert cooldown hasn't been triggered
2. Check alerting service configuration
3. Review threshold values in `.env`
4. Check database for alert records

### High False Positive Rate

**Problem:** Too many unnecessary alerts  
**Solution:**
1. Increase threshold values
2. Adjust alert cooldown period
3. Review metric calculation logic
4. Consider time-based thresholds

### Notification Delivery Failures

**Problem:** Alerts created but notifications not sent  
**Solution:**
1. Check notification channel configuration
2. Verify email/SMS/webhook credentials
3. Review notification service logs
4. Test notification channels manually

## Maintenance

### Daily Tasks
- Review active alerts
- Check system health dashboard
- Monitor resource usage trends

### Weekly Tasks
- Review resolved alerts
- Analyze metric trends
- Update threshold configurations
- Clean up old notification records

### Monthly Tasks
- Generate performance reports
- Review alert effectiveness
- Update documentation
- Conduct system health review

## Future Enhancements

1. **Predictive Alerting**: Use ML to predict issues before they occur
2. **Custom Dashboards**: Allow users to create custom metric views
3. **Alert Routing**: Route alerts to specific teams based on type
4. **Integration**: Connect with external monitoring tools (Datadog, New Relic)
5. **Mobile App**: Push notifications to mobile devices
6. **Automated Remediation**: Auto-scale resources when thresholds exceeded

## Support

For issues or questions:
- Check application logs: `logs/combined-*.log`
- Review error logs: `logs/error-*.log`
- Contact: support@khaacho.com
