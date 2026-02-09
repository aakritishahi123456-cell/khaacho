# Render Deployment Guide

## Overview

The Khaacho platform is configured for deployment on Render with:
- **Web Service**: API server handling HTTP requests
- **Worker Service**: Background jobs and workers
- **Managed PostgreSQL**: Database
- **Managed Redis**: Queue and cache

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Render Cloud                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   Web Service    │         │  Worker Service  │          │
│  │   (API Server)   │         │ (Background Jobs)│          │
│  │                  │         │                  │          │
│  │ • HTTP Requests  │         │ • Job Queues     │          │
│  │ • Health Checks  │         │ • Workers        │          │
│  │ • Admin Panel    │         │ • Cron Jobs      │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        │                                     │
│           ┌────────────┴────────────┐                        │
│           │                         │                        │
│  ┌────────▼────────┐      ┌────────▼────────┐              │
│  │   PostgreSQL    │      │      Redis       │              │
│  │   (Database)    │      │   (Queue/Cache)  │              │
│  └─────────────────┘      └──────────────────┘              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Render Account**: Sign up at https://render.com
2. **GitHub Repository**: Code must be in a Git repository
3. **WhatsApp Business API**: Credentials ready
4. **Domain** (Optional): For custom domain

## Deployment Steps

### Step 1: Prepare Repository

1. **Commit all changes**:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

2. **Verify files**:
- ✅ `render.yaml` - Render configuration
- ✅ `src/server-web.js` - Web service entry point
- ✅ `src/server-worker.js` - Worker service entry point
- ✅ `package.json` - Updated with build scripts
- ✅ `.env.production.example` - Production environment template

### Step 2: Create Render Services

#### Option A: Using render.yaml (Recommended)

1. Go to Render Dashboard
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Select the repository
5. Render will automatically detect `render.yaml`
6. Click "Apply"

Render will create:
- Web service (khaacho-api)
- Worker service (khaacho-worker)
- PostgreSQL database (khaacho-db)
- Redis instance (khaacho-redis)

#### Option B: Manual Setup

If you prefer manual setup:

**1. Create PostgreSQL Database**
- Dashboard → New → PostgreSQL
- Name: `khaacho-db`
- Plan: Starter (or higher)
- Region: Oregon (or closest to your users)

**2. Create Redis Instance**
- Dashboard → New → Redis
- Name: `khaacho-redis`
- Plan: Starter
- Region: Same as database

**3. Create Web Service**
- Dashboard → New → Web Service
- Connect repository
- Name: `khaacho-api`
- Environment: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm run start:web`
- Plan: Starter (or higher)
- Add environment variables (see below)

**4. Create Worker Service**
- Dashboard → New → Background Worker
- Connect repository
- Name: `khaacho-worker`
- Environment: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm run start:worker`
- Plan: Starter (or higher)
- Add environment variables (see below)

### Step 3: Configure Environment Variables

#### Web Service Environment Variables

**Required:**
```
NODE_ENV=production
PORT=10000
API_VERSION=v1
DATABASE_URL=[from PostgreSQL service]
REDIS_URL=[from Redis service]
JWT_SECRET=[generate secure random string]
JWT_EXPIRES_IN=7d
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=[your-phone-id]
WHATSAPP_ACCESS_TOKEN=[your-token]
WHATSAPP_VERIFY_TOKEN=[your-verify-token]
WHATSAPP_ASYNC=true
ENABLE_BACKGROUND_JOBS=false
```

**Optional (Monitoring):**
```
MONITORING_ORDER_RATE_THRESHOLD=100
MONITORING_JOB_FAILURE_THRESHOLD=10
MONITORING_WHATSAPP_FAILURE_THRESHOLD=20
MONITORING_API_ERROR_THRESHOLD=5
MONITORING_DB_LATENCY_THRESHOLD=1000
MONITORING_ALERT_COOLDOWN=300000
ALERT_EMAIL_FROM=alerts@khaacho.com
ALERT_EMAIL_TO=admin@khaacho.com
```

#### Worker Service Environment Variables

**Required:**
```
NODE_ENV=production
API_VERSION=v1
DATABASE_URL=[from PostgreSQL service]
REDIS_URL=[from Redis service]
JWT_SECRET=[same as web service]
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=[your-phone-id]
WHATSAPP_ACCESS_TOKEN=[your-token]
WHATSAPP_ASYNC=true
ENABLE_BACKGROUND_JOBS=true
```

### Step 4: Database Migration

After services are created, run migrations:

1. Go to Web Service → Shell
2. Run:
```bash
npm run db:migrate:deploy
```

Or connect to PostgreSQL directly:
```bash
# Get connection string from Render dashboard
psql [DATABASE_URL]

# Run migrations manually
\i prisma/migrations/001_initial_schema.sql
\i prisma/migrations/002_performance_views.sql
# ... continue for all migrations
```

### Step 5: Verify Deployment

#### Check Web Service

```bash
# Health check
curl https://your-app.onrender.com/api/v1/monitoring/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-08T...",
  "uptime": 10,
  "database": "connected",
  "redis": "connected",
  "memory": { ... }
}
```

#### Check Worker Service

Worker service logs should show:
```
Khaacho Worker Service
Job queue system initialized
Credit score worker initialized
Risk control worker initialized
Order routing worker initialized
Vendor performance worker initialized
Price intelligence worker initialized
Recovery worker initialized
All workers initialized successfully
```

#### Check Database

```bash
# Connect to database
psql [DATABASE_URL]

# Verify tables
\dt

# Should show all tables including:
# - users, retailers, vendors, products
# - orders, order_items
# - system_metrics, system_alerts
# - etc.
```

### Step 6: Configure WhatsApp Webhook

1. Get your web service URL: `https://your-app.onrender.com`
2. Go to Meta Developer Console
3. Configure webhook:
   - URL: `https://your-app.onrender.com/api/v1/whatsapp/webhook`
   - Verify Token: [your WHATSAPP_VERIFY_TOKEN]
   - Subscribe to: messages, message_status

### Step 7: Test the System

```bash
# Set your admin token
TOKEN="your-admin-token"

# Test API
curl -H "Authorization: Bearer $TOKEN" \
  https://your-app.onrender.com/api/v1/monitoring/metrics

# Test order creation
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"retailerId":"...","vendorId":"...","items":[...]}' \
  https://your-app.onrender.com/api/v1/orders

# Check worker logs in Render dashboard
```

## Service Configuration

### Web Service

**Purpose**: Handle HTTP requests
- API endpoints
- Admin panel
- Health checks
- Monitoring dashboard

**Scaling**: 
- Horizontal scaling supported
- Add more instances for high traffic
- Recommended: 2+ instances for production

**Health Check**:
- Path: `/api/v1/monitoring/health`
- Interval: 30 seconds
- Timeout: 10 seconds
- Unhealthy threshold: 3 failures

### Worker Service

**Purpose**: Background processing
- Job queue processing
- Scheduled tasks
- Credit score calculations
- Order routing
- WhatsApp message sending
- Recovery operations

**Scaling**:
- Vertical scaling recommended (more CPU/memory)
- Can run multiple instances if needed
- Recommended: 1 instance for starter

**Health Check**:
- Port: 10001
- Path: `/health`
- Returns worker status

## Database Configuration

### PostgreSQL

**Plan Recommendations**:
- **Starter**: Development/testing (256MB RAM, 1GB storage)
- **Standard**: Small production (1GB RAM, 10GB storage)
- **Pro**: Medium production (4GB RAM, 50GB storage)

**Connection Pooling**:
- Configured in DATABASE_URL: `connection_limit=20`
- Web service: 20 connections per instance
- Worker service: 10 connections per instance

**Backups**:
- Automatic daily backups (Render managed)
- Point-in-time recovery available
- Manual backups via Render dashboard

**Migrations**:
- Run automatically during build: `npm run build`
- Manual: `npm run db:migrate:deploy`

### Redis

**Plan Recommendations**:
- **Starter**: Development/testing (25MB)
- **Standard**: Small production (100MB)
- **Pro**: Medium production (500MB)

**Configuration**:
- Maxmemory policy: `allkeys-lru`
- Persistence: Enabled
- Eviction: Least recently used

**Usage**:
- Job queues (Bull)
- Session storage
- Cache
- Rate limiting

## Monitoring

### Health Checks

**Web Service**:
```bash
curl https://your-app.onrender.com/api/v1/monitoring/health
```

**Worker Service**:
- Render monitors process health
- Custom health endpoint on port 10001

### Logs

**Access Logs**:
- Render Dashboard → Service → Logs
- Real-time log streaming
- Search and filter capabilities

**Log Levels**:
- Production: `info` (default)
- Debug: Change `LOG_LEVEL=debug` in environment

**Log Retention**:
- Render: 7 days
- For longer retention, integrate external logging:
  - Papertrail
  - Loggly
  - Datadog

### Metrics

**Built-in Monitoring**:
- CPU usage
- Memory usage
- Request count
- Response time
- Error rate

**Custom Metrics**:
- Access via `/api/v1/monitoring/metrics`
- Dashboard: `/api/v1/monitoring/dashboard`
- Alerts: `/api/v1/monitoring/alerts`

### Alerts

**Automatic Alerts**:
- High order creation rate
- High job failure rate
- High WhatsApp failure rate
- High API error rate
- High database latency
- High CPU/memory usage

**Notification Channels**:
- Email (configure SMTP)
- Webhook (Slack, Discord)
- In-app notifications

## Scaling

### Horizontal Scaling (Web Service)

Add more instances:
1. Go to Web Service settings
2. Increase instance count
3. Render load balances automatically

**Considerations**:
- Stateless design (already implemented)
- Session storage in Redis
- Database connection pooling

### Vertical Scaling

Upgrade instance size:
1. Go to Service settings
2. Change plan (Starter → Standard → Pro)
3. More CPU and memory

**When to scale**:
- CPU > 80% sustained
- Memory > 80% sustained
- Response time > 500ms
- Error rate > 5%

### Database Scaling

**Read Replicas**:
- Available on Pro plan
- Offload read queries
- Reduce primary database load

**Connection Pooling**:
- Already configured
- Adjust `connection_limit` if needed

## Security

### HTTPS

- Automatic HTTPS (Render managed)
- Free SSL certificates
- Auto-renewal

### Environment Variables

- Encrypted at rest
- Never logged
- Access via Render dashboard only

### Database

- Private network (not publicly accessible)
- Encrypted connections
- Automatic backups

### Redis

- Private network
- Password protected
- Encrypted connections

### Rate Limiting

- Configured in application
- API: 100 requests/15 minutes
- Auth: 5 requests/15 minutes
- Webhook: 50 requests/15 minutes

## Troubleshooting

### Build Failures

**Check build logs**:
- Render Dashboard → Service → Events

**Common issues**:
- Missing dependencies: Check `package.json`
- Migration failures: Check database connection
- Environment variables: Verify all required vars set

**Solution**:
```bash
# Clear build cache
Render Dashboard → Service → Settings → Clear Build Cache
```

### Service Won't Start

**Check logs**:
```bash
# Recent logs
Render Dashboard → Service → Logs

# Look for:
# - Database connection errors
# - Redis connection errors
# - Missing environment variables
# - Port binding errors
```

**Common fixes**:
- Verify DATABASE_URL is correct
- Verify REDIS_URL is correct
- Check all required env vars are set
- Ensure migrations ran successfully

### Database Connection Issues

**Symptoms**:
- "Connection refused"
- "Too many connections"
- "Connection timeout"

**Solutions**:
1. Check DATABASE_URL format
2. Verify database is running
3. Check connection pool settings
4. Upgrade database plan if needed

### Worker Not Processing Jobs

**Check**:
1. Worker service is running
2. Redis connection is working
3. ENABLE_BACKGROUND_JOBS=true
4. Check worker logs for errors

**Debug**:
```bash
# Check Redis connection
redis-cli -u [REDIS_URL] ping
# Should return: PONG

# Check job queue
redis-cli -u [REDIS_URL] keys bull:*
```

### High Memory Usage

**Causes**:
- Memory leaks
- Large payloads
- Too many connections

**Solutions**:
1. Upgrade instance size
2. Reduce connection pool size
3. Enable compression
4. Review code for leaks

### Slow Response Times

**Check**:
1. Database query performance
2. External API calls (WhatsApp)
3. CPU usage
4. Memory usage

**Solutions**:
1. Add database indexes
2. Enable caching
3. Optimize queries
4. Scale horizontally

## Cost Optimization

### Development

**Minimal Setup**:
- Web Service: Starter ($7/month)
- Worker Service: Starter ($7/month)
- PostgreSQL: Starter ($7/month)
- Redis: Starter ($10/month)
- **Total**: ~$31/month

### Production

**Recommended Setup**:
- Web Service: Standard ($25/month) × 2 instances
- Worker Service: Standard ($25/month)
- PostgreSQL: Standard ($20/month)
- Redis: Standard ($25/month)
- **Total**: ~$120/month

### Cost Saving Tips

1. **Use free tier for development**:
   - Render offers free tier for web services
   - Limited to 750 hours/month
   - Spins down after inactivity

2. **Optimize worker usage**:
   - Single worker instance usually sufficient
   - Scale only when needed

3. **Database optimization**:
   - Regular vacuum and analyze
   - Remove old data
   - Optimize queries

4. **Redis optimization**:
   - Set appropriate TTLs
   - Use eviction policies
   - Monitor memory usage

## Maintenance

### Daily

- Check service health
- Review error logs
- Monitor metrics

### Weekly

- Review performance metrics
- Check database size
- Review alert history
- Update dependencies (if needed)

### Monthly

- Database maintenance (vacuum, analyze)
- Review and optimize queries
- Check for security updates
- Review costs and usage

### Quarterly

- Performance audit
- Security audit
- Capacity planning
- Update documentation

## Rollback Procedure

If deployment fails:

1. **Revert code**:
```bash
git revert HEAD
git push origin main
```

2. **Render auto-deploys** the previous version

3. **Manual rollback**:
   - Render Dashboard → Service → Deploys
   - Find previous successful deploy
   - Click "Redeploy"

4. **Database rollback** (if needed):
   - Restore from backup
   - Render Dashboard → Database → Backups

## Support

### Render Support

- Documentation: https://render.com/docs
- Community: https://community.render.com
- Support: support@render.com

### Application Support

- Documentation: See project docs
- Logs: `logs/` directory
- Monitoring: `/api/v1/monitoring/dashboard`

## Next Steps

1. ✅ Deploy to Render
2. ✅ Configure WhatsApp webhook
3. ✅ Test all endpoints
4. ✅ Monitor for 24 hours
5. ✅ Set up custom domain (optional)
6. ✅ Configure email alerts
7. ✅ Set up external monitoring (optional)
8. ✅ Create backup procedures
9. ✅ Document runbooks
10. ✅ Train team on operations

## Checklist

### Pre-Deployment
- [ ] Code committed and pushed
- [ ] All tests passing
- [ ] Environment variables documented
- [ ] Database migrations ready
- [ ] WhatsApp credentials ready

### Deployment
- [ ] Services created on Render
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Health checks passing
- [ ] WhatsApp webhook configured

### Post-Deployment
- [ ] All endpoints tested
- [ ] Monitoring dashboard accessible
- [ ] Alerts configured
- [ ] Logs reviewed
- [ ] Performance metrics baseline established

### Production Ready
- [ ] Custom domain configured (optional)
- [ ] SSL certificate verified
- [ ] Backup procedures tested
- [ ] Rollback procedures documented
- [ ] Team trained
- [ ] Runbooks created

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Production URL**: _______________  
**Status**: ⬜ Success / ⬜ Issues / ⬜ Rollback Required
