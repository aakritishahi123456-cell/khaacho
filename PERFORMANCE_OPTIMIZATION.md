# Performance Optimization Guide

## Overview
This document outlines all performance optimizations implemented for production deployment.

## Database Optimizations

### 1. Indexes (Migration 012)

#### Critical Indexes
- **Orders**: retailer_id, vendor_id, status, created_at combinations
- **Credit Ledgers**: retailer_id, vendor_id, transaction_type with timestamps
- **Payments**: retailer_id, vendor_id, payment_status with timestamps
- **Vendor Products**: product_id, vendor_id, availability, price
- **WhatsApp Messages**: from, is_processed with timestamps
- **Audit Logs**: user_id, entity_type, entity_id with timestamps

#### Composite Indexes
- Retailer credit score + approval status
- Vendor rating + approval status
- Product category + subcategory + active status

#### Partial Indexes (Optimized for specific queries)
- Active orders only (excludes COMPLETED/CANCELLED)
- Overdue payments only
- Pending vendor acceptances
- Unprocessed WhatsApp messages

#### Covering Indexes (Include frequently accessed columns)
- Order list with order_number, status, payment_status, total, due_amount
- Product list with product_id, vendor_price, stock

#### Text Search Indexes
- Product name (GIN trigram index)
- User name (GIN trigram index)

### 2. Connection Pooling

**Configuration** (`.env`):
```
DATABASE_URL="postgresql://postgres:pkdon123@localhost:5433/khaacho?schema=public&connection_limit=20&pool_timeout=10"
DB_POOL_MIN=10
DB_POOL_MAX=50
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=30000
DB_IDLE_TIMEOUT=60000
```

**Features**:
- Connection limit: 20 per Prisma instance
- Pool timeout: 10 seconds
- Statement timeout: 30 seconds
- Idle connection timeout: 60 seconds
- Automatic connection health checks
- Slow query logging (>1 second)

### 3. Pagination

**Utility**: `src/utils/pagination.js`

**Features**:
- Offset-based pagination (default)
- Cursor-based pagination (for large datasets)
- Configurable page size (1-100, default 20)
- Automatic metadata generation
- Sort parameter parsing

**Usage Example**:
```javascript
const { executePaginatedQuery, parsePaginationParams } = require('../utils/pagination');

// In controller
const { page, limit } = parsePaginationParams(req.query);
const result = await executePaginatedQuery(prisma.orders, {
  where: { retailerId: req.user.id },
  orderBy: { createdAt: 'desc' },
  page,
  limit,
});

res.json(result);
```

### 4. Query Monitoring

**Views Created**:
- `slow_queries`: Queries taking >100ms
- `index_usage_stats`: Index scan statistics
- `table_bloat_stats`: Table size and dead tuple monitoring
- `missing_indexes`: Sequential scans on large tables

**Check Slow Queries**:
```sql
SELECT * FROM slow_queries LIMIT 10;
```

**Check Index Usage**:
```sql
SELECT * FROM index_usage_stats WHERE index_scans < 100;
```

**Check Table Bloat**:
```sql
SELECT * FROM table_bloat_stats WHERE dead_tuple_percent > 10;
```

### 5. Maintenance

**Auto-vacuum Settings**:
- Orders, credit_ledgers, payments: analyze_scale_factor = 0.05
- More frequent statistics updates for high-traffic tables

**Manual Maintenance**:
```sql
-- Analyze tables
ANALYZE orders;

-- Vacuum and analyze
VACUUM ANALYZE orders;

-- Reindex if needed
REINDEX TABLE orders;
```

## Application Optimizations

### 1. Background Job Queue

**System**: Redis + Bull
**Queues**:
- WhatsApp (5 concurrent)
- Credit Score (2 concurrent)
- Order Routing (3 concurrent)
- Payment Reminders (3 concurrent)
- Report Generation (1 concurrent)
- Order Processing (5 concurrent)

**Benefits**:
- Non-blocking API responses
- Automatic retries (3 attempts)
- Job deduplication
- Graceful failure handling

### 2. Caching Strategy

**Redis Usage**:
- Session storage
- Job queue
- Rate limiting
- Future: Query result caching

**Recommended Caching**:
```javascript
// Cache frequently accessed data
const cacheKey = `retailer:${retailerId}:credit`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await prisma.retailers.findUnique({ where: { id: retailerId } });
await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min TTL
return data;
```

### 3. Database Connection Management

**Health Checks**:
```javascript
const { checkDatabaseConnection } = require('./config/database');
await checkDatabaseConnection();
```

**Connection Pool Stats**:
```javascript
const { getConnectionPoolStats } = require('./config/database');
const stats = await getConnectionPoolStats();
console.log(stats);
```

**Graceful Shutdown**:
```javascript
const { disconnectDatabase } = require('./config/database');
process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});
```

## Backup & Recovery

### Automated Backups

**Script**: `scripts/backup-database.ps1`

**Features**:
- Timestamped backups
- Optional compression (requires 7-Zip)
- Automatic cleanup (7-day retention)
- Backup size reporting

**Usage**:
```powershell
# Manual backup
.\scripts\backup-database.ps1

# Custom retention
.\scripts\backup-database.ps1 -RetentionDays 30

# Custom backup directory
.\scripts\backup-database.ps1 -BackupDir "D:\backups"
```

**Schedule with Task Scheduler**:
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 2:00 AM
4. Action: Start a program
5. Program: `powershell.exe`
6. Arguments: `-File "C:\path\to\scripts\backup-database.ps1"`

### Database Restore

**Script**: `scripts/restore-database.ps1`

**Usage**:
```powershell
# Restore from backup
.\scripts\restore-database.ps1 -BackupFile "backups\khaacho_backup_2026-02-08_14-30-00.sql"

# Force restore without confirmation
.\scripts\restore-database.ps1 -BackupFile "backups\backup.sql" -Force
```

## Monitoring

### Application Metrics

**Endpoints**:
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/queues/stats` - Job queue statistics
- Database connection pool stats via `getConnectionPoolStats()`

### Database Metrics

**Query Performance**:
```sql
-- Top 10 slowest queries
SELECT * FROM slow_queries ORDER BY mean_exec_time DESC LIMIT 10;

-- Unused indexes
SELECT * FROM index_usage_stats WHERE index_scans = 0;

-- Table sizes
SELECT * FROM table_bloat_stats ORDER BY total_size DESC;
```

**Connection Monitoring**:
```sql
SELECT 
  count(*) as total,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'khaacho';
```

### Log Monitoring

**Log Files**:
- `logs/combined-*.log` - All logs
- `logs/error-*.log` - Errors only
- `logs/orders-*.log` - Order processing
- `logs/whatsapp-*.log` - WhatsApp automation
- `logs/rejections-*.log` - Rejected requests

**Slow Query Logs**:
Queries taking >1 second are automatically logged with details.

## Performance Testing

### Load Testing Recommendations

**Tools**:
- Apache Bench (ab)
- Artillery
- k6

**Example with Apache Bench**:
```bash
# Test order creation endpoint
ab -n 1000 -c 10 -H "Authorization: Bearer TOKEN" \
  -p order.json -T application/json \
  http://localhost:3000/api/v1/orders
```

### Query Performance Testing

**Use EXPLAIN ANALYZE**:
```sql
EXPLAIN ANALYZE
SELECT * FROM orders 
WHERE retailer_id = 1 
  AND status = 'PENDING' 
ORDER BY created_at DESC 
LIMIT 20;
```

**Check Index Usage**:
Look for "Index Scan" instead of "Seq Scan" in EXPLAIN output.

## Production Checklist

### Before Deployment

- [ ] Apply migration 012 (indexes)
- [ ] Update DATABASE_URL with connection pool parameters
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set up monitoring alerts
- [ ] Test database restore procedure
- [ ] Run load tests
- [ ] Review slow query logs
- [ ] Check index usage statistics

### After Deployment

- [ ] Monitor connection pool usage
- [ ] Check slow query logs daily
- [ ] Review job queue statistics
- [ ] Monitor table bloat weekly
- [ ] Verify backup success daily
- [ ] Check disk space usage
- [ ] Review error logs
- [ ] Monitor API response times

## Scaling Recommendations

### Horizontal Scaling

**Application Servers**:
- Deploy multiple Node.js instances
- Use load balancer (Nginx, HAProxy)
- Share Redis instance across servers
- Each instance gets own connection pool

**Database**:
- Read replicas for read-heavy queries
- Connection pooler (PgBouncer) for many connections
- Partition large tables by date

### Vertical Scaling

**Database Server**:
- Increase RAM for larger cache
- Faster SSD for better I/O
- More CPU cores for parallel queries

**Application Server**:
- Increase Node.js memory limit
- More CPU cores for concurrent requests

### Caching Layer

**Implement Redis Caching**:
- Product catalog (1 hour TTL)
- Vendor list (30 min TTL)
- Retailer credit info (5 min TTL)
- Dashboard statistics (1 min TTL)

## Troubleshooting

### Slow Queries

1. Check `slow_queries` view
2. Run EXPLAIN ANALYZE on slow query
3. Verify index usage
4. Add missing indexes if needed
5. Consider query rewrite

### High Connection Count

1. Check connection pool stats
2. Review connection_limit setting
3. Look for connection leaks
4. Consider PgBouncer

### Table Bloat

1. Check `table_bloat_stats` view
2. Run VACUUM ANALYZE on bloated tables
3. Consider VACUUM FULL during maintenance window
4. Adjust autovacuum settings

### Job Queue Backlog

1. Check queue stats endpoint
2. Review failed jobs
3. Increase concurrent workers if needed
4. Check Redis memory usage
5. Review job processor performance

## Additional Resources

- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Prisma Performance Guide](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Bull Queue Best Practices](https://github.com/OptimalBits/bull/blob/develop/PATTERNS.md)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
