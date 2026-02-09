# Render Deployment - Quick Start

## 🚀 Deploy in 10 Minutes

### Step 1: Push to GitHub (2 minutes)

```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

### Step 2: Create Render Blueprint (3 minutes)

1. Go to https://render.com/dashboard
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repository
4. Select your repository
5. Render detects `render.yaml` automatically
6. Click **"Apply"**

Render creates:
- ✅ Web Service (API)
- ✅ Worker Service (Background Jobs)
- ✅ PostgreSQL Database
- ✅ Redis Instance

### Step 3: Add Required Environment Variables (3 minutes)

Go to each service and add:

#### Web Service (`khaacho-api`)

**Required:**
```
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-token
WHATSAPP_VERIFY_TOKEN=your-verify-token
```

**Optional (for alerts):**
```
ALERT_EMAIL_FROM=alerts@khaacho.com
ALERT_EMAIL_TO=admin@khaacho.com
```

#### Worker Service (`khaacho-worker`)

**Required:**
```
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_ACCESS_TOKEN=your-token
```

> **Note**: DATABASE_URL, REDIS_URL, and JWT_SECRET are automatically set by Render

### Step 4: Wait for Build (2 minutes)

Render automatically:
1. Installs dependencies
2. Runs database migrations
3. Starts services

Watch the logs in real-time.

### Step 5: Verify Deployment (1 minute)

```bash
# Get your URL from Render dashboard
# Test health endpoint
curl https://your-app.onrender.com/api/v1/monitoring/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-08T...",
  "database": "connected",
  "redis": "connected"
}
```

## ✅ You're Live!

Your app is now running on Render:
- **API**: `https://your-app.onrender.com`
- **Admin Panel**: `https://your-app.onrender.com/admin`
- **Health Check**: `https://your-app.onrender.com/api/v1/monitoring/health`

## 📋 Post-Deployment Tasks

### Configure WhatsApp Webhook

1. Go to Meta Developer Console
2. WhatsApp → Configuration → Webhook
3. Set URL: `https://your-app.onrender.com/api/v1/whatsapp/webhook`
4. Set Verify Token: (your WHATSAPP_VERIFY_TOKEN)
5. Subscribe to: `messages`, `message_status`

### Test the System

```bash
# Login to admin panel
open https://your-app.onrender.com/admin

# Get your admin token from browser storage
# Then test API:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.onrender.com/api/v1/monitoring/metrics
```

### Monitor Services

Check Render dashboard:
- **Web Service**: Should show "Live" status
- **Worker Service**: Should show "Live" status
- **Database**: Should show "Available" status
- **Redis**: Should show "Available" status

## 🔧 Common Issues

### Build Failed

**Check**: Build logs in Render dashboard

**Fix**: Usually missing environment variables or migration issues

### Service Won't Start

**Check**: Service logs

**Common causes**:
- Missing DATABASE_URL (should be auto-set)
- Missing REDIS_URL (should be auto-set)
- Missing WhatsApp credentials

### Database Connection Error

**Fix**: Verify DATABASE_URL is set correctly
- Go to Database → Connection Info
- Copy Internal Database URL
- Paste into service environment variables

## 📊 Monitoring

### Health Checks

Render automatically monitors:
- Web service: `/api/v1/monitoring/health` every 30 seconds
- Worker service: Process health

### Logs

View real-time logs:
- Render Dashboard → Service → Logs
- Filter by level: info, error, warn

### Metrics

Access monitoring dashboard:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.onrender.com/api/v1/monitoring/dashboard
```

## 💰 Costs

### Starter Plan (~$31/month)
- Web Service: $7/month
- Worker Service: $7/month
- PostgreSQL: $7/month
- Redis: $10/month

### Free Tier (Development)
- Web Service: Free (750 hours/month)
- Spins down after 15 minutes of inactivity
- Not recommended for production

## 🆘 Need Help?

### Documentation
- Full guide: `RENDER_DEPLOYMENT.md`
- Render docs: https://render.com/docs

### Support
- Render community: https://community.render.com
- Render support: support@render.com

## 🎉 Success!

Your Khaacho platform is now live on Render with:
- ✅ Automatic HTTPS
- ✅ Auto-scaling
- ✅ Automatic backups
- ✅ Zero-downtime deploys
- ✅ Health monitoring
- ✅ Log aggregation

**Next**: Configure your custom domain (optional)

---

**Quick Links**:
- Dashboard: https://render.com/dashboard
- Docs: https://render.com/docs
- Status: https://status.render.com
