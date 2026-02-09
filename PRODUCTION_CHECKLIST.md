# Production Deployment Checklist

## Pre-Deployment

### Database Setup
- [ ] PostgreSQL 14+ installed and running
- [ ] Database created: `khaacho`
- [ ] Database user created with proper permissions
- [ ] All migrations applied (001-012)
- [ ] Production optimization migration applied (012)
- [ ] Database indexes verified
- [ ] Connection pooling configured
- [ ] Backup script tested

### Redis Setup
- [ ] Redis 6+ installed and running
- [ ] Redis accessible from application
- [ ] Redis password configured (if applicable)
- [ ] Redis persistence enabled

### Environment Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `DATABASE_URL` configured with connection pool parameters
- [ ] `REDIS_HOST` and `REDIS_PORT` configured
- [ ] `JWT_SECRET` set to strong random value
- [ ] `NODE_ENV` set to `production`
- [ ] WhatsApp API credentials configured
- [ ] All required environment variables set

### Application Setup
- [ ] Dependencies installed: `npm install`
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Application starts without errors
- [ ] Health check endpoint responds: `/api/v1/health`
- [ ] All workers initialize successfully

### Security
- [ ] JWT secret is strong and unique
- [ ] Database password is strong
- [ ] Redis password set (if exposed)
- [ ] Rate limiting configured
- [ ] CORS configured for production domains
- [ ] Helmet.js security headers enabled
- [ ] Input validation on all endpoints
- [ ] SQL injection protection verified
- [ ] XSS protection enabled

## Deployment

### Code Deployment
- [ ] Code pushed to production branch
- [ ] Build successful
- [ ] No TypeScript/ESLint errors
- [ ] All tests passing (if applicable)

### Database Migration
- [ ] Backup created before migration
- [ ] Migrations applied in order
- [ ] Migration 012 (optimization) applied
- [ ] Database schema verified
- [ ] Indexes created successfully
- [ ] Monitoring views created

### Application Start
- [ ] Application deployed
- [ ] Server starts successfully
- [ ] No startup errors in logs
- [ ] All 6 job queues initialized
- [ ] All 7 workers started
- [ ] Health check passes

## Post-Deployment Verification

### Functional Testing
- [ ] User registration works
- [ ] User login works
- [ ] Order creation works
- [ ] Order routing works
- [ ] Payment recording works
- [ ] Credit score calculation works
- [ ] WhatsApp webhook responds
- [ ] Background jobs process

### Performance Testing
- [ ] Response times acceptable (<500ms for most endpoints)
- [ ] Database queries use indexes (check with EXPLAIN)
- [ ] Connection pool not exhausted
- [ ] Memory usage stable
- [ ] CPU usage reasonable
- [ ] No memory leaks detected

### Monitoring Setup
- [ ] Application logs being written
- [ ] Error logs being captured
- [ ] Slow query logging enabled
- [ ] Job queue stats accessible
- [ ] Database monitoring views working
- [ ] Health check endpoint monitored

### Backup & Recovery
- [ ] Automated backup script scheduled
- [ ] Backup location configured
- [ ] Backup retention policy set (7 days default)
- [ ] Restore procedure tested
- [ ] Backup notifications configured

## Ongoing Maintenance

### Daily Tasks
- [ ] Check error logs: `logs/error-*.log`
- [ ] Verify backup success
- [ ] Monitor disk space
- [ ] Check job queue stats: `GET /api/v1/queues/stats`
- [ ] Review slow queries: `SELECT * FROM slow_queries`

### Weekly Tasks
- [ ] Review application performance
- [ ] Check database bloat: `SELECT * FROM table_bloat_stats`
- [ ] Review index usage: `SELECT * FROM index_usage_stats`
- [ ] Check for failed jobs
- [ ] Review security logs
- [ ] Update dependencies (if needed)

### Monthly Tasks
- [ ] Full database backup verification
- [ ] Performance optimization review
- [ ] Security audit
- [ ] Capacity planning review
- [ ] Documentation updates
- [ ] Dependency updates

## Monitoring Endpoints

### Health Checks
```bash
# Application health
curl http://localhost:3000/api/v1/health

# Job queue stats
curl http://localhost:3000/api/v1/queues/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database Monitoring
```sql
-- Slow queries
SELECT * FROM slow_queries LIMIT 10;

-- Index usage
SELECT * FROM index_usage_stats WHERE index_scans < 100;

-- Table bloat
SELECT * FROM table_bloat_stats WHERE dead_tuple_percent > 10;

-- Connection pool
SELECT count(*) as total,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'khaacho';
```

## Rollback Procedure

### If Deployment Fails

1. **Stop Application**
```bash
# Stop the application server
pm2 stop khaacho
# or
docker stop khaacho-app
```

2. **Restore Database** (if migrations were applied)
```powershell
.\scripts\restore-database.ps1 -BackupFile "backups\pre-deployment-backup.sql"
```

3. **Revert Code**
```bash
git checkout previous-stable-tag
npm install
npx prisma generate
```

4. **Restart Application**
```bash
pm2 start khaacho
# or
docker start khaacho-app
```

5. **Verify**
```bash
curl http://localhost:3000/api/v1/health
```

## Performance Benchmarks

### Expected Performance
- **API Response Time**: <200ms (p50), <500ms (p95)
- **Database Query Time**: <50ms (p50), <200ms (p95)
- **Job Processing**: <5s per job (average)
- **Memory Usage**: <512MB (idle), <1GB (peak)
- **CPU Usage**: <20% (idle), <60% (peak)

### Load Capacity
- **Concurrent Users**: 100+
- **Requests per Second**: 50+
- **Orders per Day**: 10,000+
- **Database Connections**: 20 per instance
- **Job Queue Throughput**: 100+ jobs/minute

## Troubleshooting

### Application Won't Start
1. Check logs: `logs/error-*.log`
2. Verify environment variables
3. Test database connection
4. Test Redis connection
5. Check port availability

### Slow Performance
1. Check slow queries: `SELECT * FROM slow_queries`
2. Verify indexes are being used
3. Check connection pool usage
4. Review job queue backlog
5. Check Redis memory usage

### Database Issues
1. Check connection pool stats
2. Review table bloat
3. Run VACUUM ANALYZE if needed
4. Check disk space
5. Review slow query log

### Job Queue Issues
1. Check queue stats endpoint
2. Review failed jobs
3. Check Redis connection
4. Verify worker processes running
5. Check Redis memory

## Support Contacts

- **Technical Lead**: [Contact Info]
- **Database Admin**: [Contact Info]
- **DevOps**: [Contact Info]
- **On-Call**: [Contact Info]

## Documentation References

- [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md) - Performance guide
- [OPTIMIZATION_QUICK_START.md](OPTIMIZATION_QUICK_START.md) - Quick optimization guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database schema
- [JOB_QUEUE_SYSTEM.md](JOB_QUEUE_SYSTEM.md) - Job queue system

## Version History

- **v1.0.0** - Initial production release
  - Core order management
  - Credit system
  - WhatsApp integration
  
- **v1.1.0** - Advanced features
  - Risk control system
  - Financial export
  - Order routing
  
- **v1.2.0** - Performance & analytics
  - Vendor performance tracking
  - Price intelligence
  - Background job queue
  - Production optimization

## Notes

- Always create a backup before applying migrations
- Test restore procedure regularly
- Monitor slow queries daily
- Keep documentation updated
- Review security regularly
- Plan for scaling early
