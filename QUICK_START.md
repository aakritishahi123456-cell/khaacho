# Khaacho Platform - Quick Start Guide

## 🚀 Start the Server

```bash
npm run dev
```

The server will start on **http://localhost:3000**

## ✅ Verify Everything Works

### 1. Check Health
```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-02-07T..."}
```

### 2. Login as Admin
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@khaacho.com\",\"password\":\"admin123\"}"
```

Save the `token` from the response.

### 3. Test Risk Control
```bash
# Get risk score for retailer
curl http://localhost:3000/api/v1/risk-control/retailers/1/score \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Test Financial Export
```bash
# Get credit summary report
curl "http://localhost:3000/api/v1/financial-export/credit-summary?format=json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Test Order Routing
```bash
# Create an order first, then route it
curl -X POST http://localhost:3000/api/v1/order-routing/route/ORDER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Access Admin Panel

Open in browser: **http://localhost:3000/admin**

Login with:
- Email: `admin@khaacho.com`
- Password: `admin123`

## 🔄 Background Workers

These start automatically when the server starts:
- ✅ Credit Score Worker
- ✅ Risk Control Worker (runs hourly)
- ✅ Order Routing Worker (runs every 15 min)

Check logs in `logs/` directory to see worker activity.

## 🗄️ Database Access

### Using Prisma Studio
```bash
npm run db:studio
```

Opens GUI at **http://localhost:5555**

### Using psql
```bash
docker exec -it postgres-khaacho psql -U postgres -d khaacho
```

## 📝 Test Scripts

### Test Risk Control
```bash
node test-risk-control.js
```

### Test Financial Export
```bash
node test-financial-export.js
```

## 🎯 Key API Endpoints

All endpoints require authentication (except `/auth/login` and `/auth/register`).

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register new user

### Risk Control
- `GET /api/v1/risk-control/retailers/:id/score` - Get risk score
- `GET /api/v1/risk-control/retailers/:id/alerts` - Get alerts
- `POST /api/v1/risk-control/check/:id` - Run risk check

### Financial Export
- `GET /api/v1/financial-export/credit-summary?format=json`
- `GET /api/v1/financial-export/purchase-volume?format=csv`
- `GET /api/v1/financial-export/payment-discipline?format=pdf`
- `GET /api/v1/financial-export/outstanding-liability?format=json`

### Order Routing
- `POST /api/v1/order-routing/route/:orderId` - Route order
- `POST /api/v1/order-routing/accept/:routingId` - Accept order
- `POST /api/v1/order-routing/reject/:routingId` - Reject order
- `GET /api/v1/order-routing/vendor/:vendorId/pending` - Pending orders

## 🛠️ Troubleshooting

### Server won't start
1. Check Docker containers are running:
   ```bash
   docker ps
   ```
2. Verify `.env` file exists with correct credentials
3. Check logs in `logs/` directory

### Database connection error
1. Verify PostgreSQL container is running on port 5433
2. Check DATABASE_URL in `.env`:
   ```
   DATABASE_URL=postgresql://postgres:pkdon123@localhost:5433/khaacho?schema=public
   ```

### Redis connection error
1. Verify Redis container is running on port 6379
2. Check REDIS_URL in `.env`:
   ```
   REDIS_URL=redis://localhost:6379
   ```

## 📚 Full Documentation

See `SYSTEM_STATUS.md` for complete system overview and all available documentation files.
