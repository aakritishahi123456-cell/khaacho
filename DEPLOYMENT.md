# Deployment Guide for Khaacho Platform

## Render Deployment

### Prerequisites
1. GitHub repository
2. Render account
3. WhatsApp Business API credentials

### Quick Deploy

1. Push to GitHub
2. Create Render account and connect GitHub
3. Click "New" → "Blueprint"
4. Select repository (render.yaml auto-detected)
5. Add WhatsApp environment variables
6. Run migrations: `npx prisma migrate deploy`

### Manual Steps

**Database:**
- New → PostgreSQL
- Name: khaacho-db
- Copy connection string

**Web Service:**
- New → Web Service
- Build: `npm install && npx prisma generate`
- Start: `npm start`
- Add environment variables

### Post-Deployment

1. Verify: `curl https://your-app.onrender.com/api/v1/health`
2. Configure WhatsApp webhook URL
3. Seed database: `npm run db:seed`

## Environment Variables

Required:
- DATABASE_URL
- JWT_SECRET
- WHATSAPP_API_URL
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_VERIFY_TOKEN
