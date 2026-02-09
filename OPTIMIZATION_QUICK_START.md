# Database Optimization - Quick Start

## Apply Optimization (One-Time Setup)

### Step 1: Apply Migration
```powershell
# Start Docker Desktop first, then run:
.\scripts\apply-optimization.ps1
```

This creates:
- 30+ performance indexes
- Query monitoring views
- Connection pool optimization
- Autovacuum tuning

### Step 2: Restart Application
```powershell
# Stop current server (Ctrl+C), then:
npm start
```

The updated `.env` file already has connection pool settings configured.

## Daily Operations

### Check Database Health
```sql
-- Connect to database
docker exec -it postgres-khaacho psql -U postgres -d khaacho

-- Check slow queries
SELECT query, mean_exec_time, calls FROM slow_queries LIMIT 5;

-- Check index usage
SELECT tablename, indexname, index_scans FROM index_usage_stats WHERE index_scans < 100;

-- Check table bloat
SELECT tablename, dead_tuple_percent FROM table_bloat_stats WHERE dead_tuple_percent > 10;
```

### Backup Database
```powershell
# Manual backup
.\scripts\backup-database.ps1

# Backups are saved to: backups/khaacho_backup_YYYY-MM-DD_HH-mm-ss.sql
```

### Restore Database
```powershell
.\scripts\restore-database.ps1 -BackupFile "backups\khaacho_backup_2026-02-08_14-30-00.sql"
```

## Automated Backups (Recommended)

### Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task → "Database Backup"
3. Trigger: Daily at 2:00 AM
4. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-File "C:\full\path\to\scripts\backup-database.ps1"`
5. Save and test

## Using Pagination in Code

### Example: List Orders with Pagination
```javascript
const { executePaginatedQuery, parsePaginationParams } = require('../utils/pagination');

// In your controller
async function listOrders(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  
  const result = await executePaginatedQuery(prisma.orders, {
    where: { retailerId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { retailer: true, vendor: true },
    page,
    limit,
  });
  
  res.json(result);
}
```

### API Request
```
GET /api/v1/orders?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

### Response Format
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

## Monitoring

### Application Health
```
GET http://localhost:3000/api/v1/health
```

### Job Queue Stats
```
GET http://localhost:3000/api/v1/queues/stats
```

### Database Connection Pool
```javascript
const { getConnectionPoolStats } = require('./config/database');
const stats = await getConnectionPoolStats();
console.log(stats);
```

## Performance Tips

### 1. Always Use Pagination
```javascript
// ❌ Bad - Loads all records
const orders = await prisma.orders.findMany();

// ✅ Good - Paginated
const result = await executePaginatedQuery(prisma.orders, { page: 1, limit: 20 });
```

### 2. Use Indexes in Queries
```javascript
// ✅ Good - Uses idx_orders_retailer_status_created
const orders = await prisma.orders.findMany({
  where: { 
    retailerId: 1, 
    status: 'PENDING' 
  },
  orderBy: { createdAt: 'desc' },
});
```

### 3. Avoid N+1 Queries
```javascript
// ❌ Bad - N+1 queries
const orders = await prisma.orders.findMany();
for (const order of orders) {
  const retailer = await prisma.retailers.findUnique({ where: { id: order.retailerId } });
}

// ✅ Good - Single query with include
const orders = await prisma.orders.findMany({
  include: { retailer: true },
});
```

### 4. Use Background Jobs for Heavy Tasks
```javascript
// ❌ Bad - Blocks API response
await sendWhatsAppMessage(phone, message);
await updateCreditScore(retailerId);

// ✅ Good - Queue for background processing
await queueManager.addJob('whatsapp', { phone, message });
await queueManager.addJob('creditScore', { retailerId });
```

## Troubleshooting

### Slow Queries
1. Check `slow_queries` view
2. Run `EXPLAIN ANALYZE` on the query
3. Verify indexes are being used
4. Add missing indexes if needed

### High Memory Usage
1. Check connection pool size
2. Review query result sizes
3. Ensure pagination is used
4. Check for memory leaks in workers

### Job Queue Backlog
1. Check queue stats: `GET /api/v1/queues/stats`
2. Increase concurrent workers if needed
3. Review failed jobs
4. Check Redis memory

### Database Connection Issues
1. Check Docker container: `docker ps`
2. Test connection: `docker exec postgres-khaacho psql -U postgres -d khaacho -c "SELECT 1"`
3. Review connection pool settings in `.env`
4. Check logs: `logs/error-*.log`

## Files Reference

- **Migration**: `prisma/migrations/012_production_optimization.sql`
- **Pagination Utility**: `src/utils/pagination.js`
- **Database Config**: `src/config/database.js`
- **Backup Script**: `scripts/backup-database.ps1`
- **Restore Script**: `scripts/restore-database.ps1`
- **Apply Script**: `scripts/apply-optimization.ps1`
- **Full Guide**: `PERFORMANCE_OPTIMIZATION.md`

## Support

For detailed information, see:
- `PERFORMANCE_OPTIMIZATION.md` - Complete optimization guide
- `JOB_QUEUE_SYSTEM.md` - Background job system
- `DATABASE_SCHEMA.md` - Database structure
- `API_DOCUMENTATION.md` - API endpoints
