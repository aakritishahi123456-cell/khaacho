# Khaacho Platform

Production-ready B2B ordering and credit platform for Surkhet, Nepal. Connects retailers with wholesalers/vendors through WhatsApp ordering while maintaining structured financial records for credit scoring and bank loan eligibility.

## Features

- **WhatsApp Integration**: Order placement and notifications via WhatsApp Business API
- **Role-Based Access**: Separate interfaces for retailers, vendors, and admins
- **Order Management**: Complete order lifecycle from creation to delivery
- **Credit System**: Comprehensive credit ledger and payment tracking
- **Credit Scoring**: Automated credit score calculation for retailers
- **Financial Auditability**: Every transaction recorded with full audit trail
- **Smart Order Routing**: Automatic vendor selection based on availability, proximity, and performance
- **Vendor Performance Tracking**: Real-time metrics and reliability scoring
- **Price Intelligence**: Historical price tracking and market analytics
- **Risk Control System**: Automated credit limit management and alerts
- **Background Job Queue**: Redis-based async processing for scalability
- **Production Optimized**: 30+ database indexes, connection pooling, and monitoring

## Tech Stack

- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with Bull
- **API**: RESTful architecture
- **Integration**: WhatsApp Business API
- **Deployment**: Docker-ready, Render-compatible

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6.0
- Docker (recommended for local development)
- WhatsApp Business API account

## Installation

### Quick Start (Windows)

1. Clone the repository
2. Run setup script:
```powershell
.\setup.ps1
```

This will:
- Install dependencies
- Start PostgreSQL and Redis in Docker
- Create database and run migrations
- Seed initial data

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Start PostgreSQL and Redis:
```bash
docker-compose up -d
```

3. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

4. Run database migrations:
```bash
npx prisma generate
Get-Content "prisma/migrations/001_initial_schema.sql" | docker exec -i postgres-khaacho psql -U postgres -d khaacho
# ... repeat for all migrations
```

5. Apply production optimizations:
```powershell
.\scripts\apply-optimization.ps1
```

6. Start the server:
```bash
npm start
```

See `QUICK_START.md` for detailed instructions.

## Environment Variables

See `.env.example` for required configuration:
- **Database**: PostgreSQL connection with pool settings
- **Redis**: Cache and job queue configuration
- **JWT**: Authentication secrets
- **WhatsApp**: Business API credentials
- **Server**: Port and environment settings

Key settings for production:
```env
DATABASE_URL="postgresql://user:pass@host:5433/khaacho?connection_limit=20&pool_timeout=10"
REDIS_HOST=localhost
REDIS_PORT=6379
ENABLE_BACKGROUND_JOBS=true
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/profile` - Get user profile

### Orders
- `POST /api/v1/orders` - Create order (Retailer)
- `GET /api/v1/orders` - List orders (paginated)
- `GET /api/v1/orders/:id` - Get order details
- `PATCH /api/v1/orders/:id/status` - Update order status (Vendor/Admin)

### Order Routing
- `POST /api/v1/order-routing/route` - Auto-route order to best vendor
- `GET /api/v1/order-routing/recommendations/:orderId` - Get vendor recommendations
- `POST /api/v1/order-routing/accept` - Vendor accepts order
- `POST /api/v1/order-routing/reject` - Vendor rejects order

### Products
- `POST /api/v1/products` - Create product (Vendor)
- `GET /api/v1/products` - List products (paginated)
- `PATCH /api/v1/products/:id` - Update product (Vendor/Admin)

### Credit & Financial
- `POST /api/v1/credit/payment` - Record payment (Vendor/Admin)
- `GET /api/v1/credit/history` - Get credit history
- `GET /api/v1/credit/score/:retailerId?` - Calculate credit score
- `GET /api/v1/financial-export/credit-summary` - Export credit summary
- `GET /api/v1/financial-metrics/retailer/:id` - Get retailer metrics

### Risk Control
- `GET /api/v1/risk-control/score/:retailerId` - Get risk score
- `GET /api/v1/risk-control/alerts` - List risk alerts
- `POST /api/v1/risk-control/rules` - Create risk rule (Admin)

### Vendor Performance
- `GET /api/v1/vendor-performance/metrics/:vendorId` - Get vendor metrics
- `GET /api/v1/vendor-performance/leaderboard` - Vendor rankings
- `GET /api/v1/vendor-performance/dashboard/:vendorId` - Performance dashboard

### Price Intelligence
- `GET /api/v1/price-intelligence/history/:productId` - Price history
- `GET /api/v1/price-intelligence/market-average/:productId` - Market average
- `GET /api/v1/price-intelligence/alerts` - Price alerts
- `GET /api/v1/price-intelligence/recommendations/:productId` - Best price vendor

### Background Jobs
- `GET /api/v1/queues/stats` - Queue statistics
- `GET /api/v1/queues/jobs/:queueName` - List jobs in queue
- `POST /api/v1/queues/retry/:jobId` - Retry failed job

### WhatsApp
- `GET /api/v1/whatsapp/webhook` - Webhook verification
- `POST /api/v1/whatsapp/webhook` - Receive messages

See `API_DOCUMENTATION.md` for complete API reference.

## Database Schema

Key models:
- **User**: Base user with role (ADMIN, VENDOR, RETAILER)
- **Vendor**: Vendor profile with credit limits and performance metrics
- **Retailer**: Retailer profile with credit score and risk assessment
- **Product**: Product catalog
- **VendorProduct**: Vendor-specific pricing and availability
- **Order**: Order with items and payment tracking
- **OrderItem**: Individual items in an order
- **CreditLedger**: Financial transaction ledger
- **Payment**: Payment records
- **VendorOrderAcceptance**: Order routing and acceptance tracking
- **VendorPerformanceMetrics**: Real-time vendor performance data
- **PriceHistory**: Historical product pricing
- **RiskControl**: Automated risk management rules
- **WhatsAppMessage**: Message history
- **AuditLog**: Complete audit trail

See `DATABASE_SCHEMA.md` for complete schema documentation.

## Performance & Optimization

### Database Optimization
- **30+ Indexes**: Optimized for high-traffic queries
- **Connection Pooling**: Configured for 20 connections per instance
- **Query Monitoring**: Slow query detection and logging
- **Pagination**: All list endpoints support pagination
- **Monitoring Views**: slow_queries, index_usage_stats, table_bloat_stats

### Background Processing
- **6 Job Queues**: WhatsApp, Credit Score, Order Routing, Payment Reminders, Reports, Order Processing
- **Automatic Retries**: 3 attempts with exponential backoff
- **Job Deduplication**: Prevents duplicate processing
- **Graceful Shutdown**: Proper cleanup on server stop

### Backup & Recovery
- **Automated Backups**: PowerShell script with 7-day retention
- **Quick Restore**: One-command database restore
- **Compression Support**: Optional backup compression

See `PERFORMANCE_OPTIMIZATION.md` and `OPTIMIZATION_QUICK_START.md` for details.

## Credit Scoring Algorithm

Credit score (300-900) based on:
- Payment history (40%)
- Outstanding debt ratio (30%)
- Order volume (20%)
- Account age (10%)

## Deployment on Render

### Prerequisites
- PostgreSQL database (Render PostgreSQL or external)
- Redis instance (Render Redis or external)

### Steps
1. Create new Web Service on Render
2. Connect your repository
3. Set environment variables (see `.env.example`)
4. Configure build and start commands:

**Build Command**: 
```bash
npm install && npx prisma generate
```

**Start Command**: 
```bash
npm start
```

5. Add PostgreSQL and Redis services
6. Run migrations manually via Render Shell:
```bash
psql $DATABASE_URL < prisma/migrations/001_initial_schema.sql
# ... repeat for all migrations
```

7. Deploy

See `DEPLOYMENT.md` for detailed deployment guide.

## Docker Deployment

```bash
# Build image
docker build -t khaacho-platform .

# Run with docker-compose
docker-compose up -d

# Apply migrations
docker exec khaacho-app npm run db:migrate
```

## Security Features

- Helmet.js for HTTP headers
- Rate limiting
- JWT authentication
- Input validation
- Error handling
- Audit logging

## Logging

Logs stored in `logs/` directory with daily rotation:
- `error-*.log` - Error logs
- `combined-*.log` - All logs
- `orders-*.log` - Order processing logs
- `whatsapp-*.log` - WhatsApp integration logs
- `rejections-*.log` - Rejected requests
- `exceptions-*.log` - Uncaught exceptions

Retention: 30 days, Max size: 50MB per file

## Documentation

- `README.md` - This file
- `QUICK_START.md` - Quick setup guide
- `API_DOCUMENTATION.md` - Complete API reference
- `DATABASE_SCHEMA.md` - Database structure
- `ARCHITECTURE.md` - System architecture
- `DEPLOYMENT.md` - Deployment guide
- `PERFORMANCE_OPTIMIZATION.md` - Performance guide
- `OPTIMIZATION_QUICK_START.md` - Quick optimization guide
- `JOB_QUEUE_SYSTEM.md` - Background job system
- `ORDER_ROUTING_API.md` - Order routing documentation
- `VENDOR_PERFORMANCE_API.md` - Vendor performance tracking
- `PRICE_INTELLIGENCE_API.md` - Price intelligence system
- `RISK_CONTROL_API.md` - Risk control system
- `FINANCIAL_EXPORT_API.md` - Financial export functionality
- `CREDIT_SCORING.md` - Credit scoring algorithm
- `ORDER_LIFECYCLE.md` - Order lifecycle management

## License

MIT
