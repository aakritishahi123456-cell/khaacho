# Production Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] All features implemented and tested
- [ ] No console.log statements in production code
- [ ] Error handling implemented everywhere
- [ ] Input validation on all endpoints
- [ ] SQL injection protection verified (Prisma handles this)
- [ ] XSS protection enabled (Helmet configured)

### Database
- [ ] All migrations created and tested
- [ ] Indexes created on frequently queried columns
- [ ] Foreign key constraints verified
- [ ] Backup strategy defined
- [ ] Connection pooling configured
- [ ] Row-level security policies applied

### Environment Variables
- [ ] All required env vars documented in .env.example
- [ ] Sensitive values not committed to git
- [ ] Production values different from development
- [ ] JWT_SECRET is strong and unique
- [ ] Database URL uses SSL connection

### Security
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Helmet.js security headers enabled
- [ ] Authentication required on protected routes
- [ ] Authorization checks on all actions
- [ ] Passwords hashed with bcrypt (12 rounds)
- [ ] No sensitive data in logs

### Performance
- [ ] Database queries optimized
- [ ] Indexes verified with EXPLAIN
- [ ] Response compression enabled
- [ ] Connection pooling configured
- [ ] Materialized views created
- [ ] Slow query logging enabled

## Deployment Steps

### 1. Prepare Repository
```bash
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0
```

### 2. Render Setup
- [ ] Create Render account
- [ ] Connect GitHub repository
- [ ] Create PostgreSQL database
- [ ] Create Web Service
- [ ] Configure environment variables
- [ ] Set build command: `npm install && npx prisma generate`
- [ ] Set start command: `npm start`

### 3. Database Migration
```bash
# In Render shell
npx prisma migrate deploy
```

### 4. Seed Initial Data
```bash
# In Render shell (optional)
npm run db:seed
```

### 5. WhatsApp Configuration
- [ ] WhatsApp Business API account created
- [ ] Phone number verified
- [ ] Webhook URL configured: `https://your-app.onrender.com/api/v1/whatsapp/webhook`
- [ ] Verify token set
- [ ] Access token configured
- [ ] Test message sent successfully

## Post-Deployment

### Verification
- [ ] Health check endpoint responds: `/api/v1/health`
- [ ] Can register new user
- [ ] Can login successfully
- [ ] Can create order
- [ ] WhatsApp webhook receives messages
- [ ] Database connections working
- [ ] Logs being written

### Monitoring Setup
- [ ] Error tracking configured (e.g., Sentry)
- [ ] Uptime monitoring (e.g., UptimeRobot)
- [ ] Database performance monitoring
- [ ] Log aggregation (e.g., Papertrail)
- [ ] Alert thresholds configured

### Performance Verification
```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-app.onrender.com/api/v1/health

# Load test
ab -n 1000 -c 50 https://your-app.onrender.com/api/v1/health
```

### Security Scan
- [ ] SSL certificate valid
- [ ] Security headers present
- [ ] No exposed secrets
- [ ] Rate limiting working
- [ ] CORS configured correctly

## Rollback Plan

### If Deployment Fails
```bash
# Revert to previous version
git revert HEAD
git push origin main

# Or rollback in Render dashboard
# Deploy → Manual Deploy → Select previous commit
```

### Database Rollback
```bash
# If migration fails
npx prisma migrate resolve --rolled-back <migration-name>
```

## Maintenance

### Daily
- [ ] Check error logs
- [ ] Monitor response times
- [ ] Check database size
- [ ] Verify backup completion

### Weekly
- [ ] Review slow queries
- [ ] Check disk space
- [ ] Analyze user activity
- [ ] Review security logs

### Monthly
- [ ] Update dependencies
- [ ] Review and optimize indexes
- [ ] Test backup restoration
- [ ] Review and update documentation
- [ ] Analyze performance trends

## Scaling Checklist

### When to Scale
- Response time > 1 second
- CPU usage > 80%
- Memory usage > 85%
- Database connections maxed out
- Error rate > 1%

### Scaling Options
- [ ] Upgrade Render plan
- [ ] Add read replicas
- [ ] Implement caching (Redis)
- [ ] Optimize database queries
- [ ] Add CDN for static assets
- [ ] Implement queue for background jobs

## Emergency Contacts
- Database Admin: [contact]
- DevOps Lead: [contact]
- WhatsApp API Support: [contact]
- Render Support: support@render.com
