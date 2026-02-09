# Khaacho Platform Architecture

## System Overview

Khaacho is a production-ready B2B ordering and credit platform designed for Surkhet, Nepal. It connects retailers with wholesalers/vendors through WhatsApp ordering while maintaining structured financial records for credit scoring and bank loan eligibility.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     WhatsApp Business API                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Khaacho Backend (Node.js)                 │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   WhatsApp   │  │    Order     │  │    Credit    │      │
│  │   Service    │──│  Lifecycle   │──│   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │  Analytics   │  │     Auth     │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL Database (Prisma ORM)              │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Users   │  │ Retailers│  │ Vendors  │  │ Products │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Orders  │  │  Credit  │  │ Payments │  │  Audit   │   │
│  │          │  │  Ledger  │  │          │  │   Logs   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: JavaScript (ES6+)
- **ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: express-validator
- **Logging**: Winston

### Database
- **Primary**: PostgreSQL 15+
- **Features Used**:
  - JSONB for flexible metadata
  - Triggers for automation
  - Materialized views for analytics
  - Row-level security
  - Full-text search (pg_trgm)

### External Services
- **WhatsApp Business API**: Message sending and receiving
- **Render**: Hosting platform

### Security
- **Helmet.js**: HTTP security headers
- **bcryptjs**: Password hashing
- **express-rate-limit**: Rate limiting
- **CORS**: Cross-origin resource sharing

## Directory Structure

```
khaacho-platform/
├── src/
│   ├── config/
│   │   ├── index.js              # Configuration management
│   │   └── database.js           # Prisma client setup
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── order.controller.js
│   │   ├── orderLifecycle.controller.js
│   │   ├── product.controller.js
│   │   ├── credit.controller.js
│   │   ├── whatsapp.controller.js
│   │   ├── dashboard.controller.js
│   │   └── analytics.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── order.service.js
│   │   ├── orderLifecycle.service.js
│   │   ├── credit.service.js
│   │   ├── whatsapp.service.js
│   │   ├── whatsappOrderParser.service.js
│   │   ├── dashboard.service.js
│   │   └── analytics.service.js
│   ├── middleware/
│   │   ├── auth.js               # Authentication & authorization
│   │   ├── validation.js         # Input validation
│   │   └── errorHandler.js       # Global error handling
│   ├── routes/
│   │   ├── index.js              # Route aggregator
│   │   ├── auth.routes.js
│   │   ├── order.routes.js
│   │   ├── orderLifecycle.routes.js
│   │   ├── product.routes.js
│   │   ├── credit.routes.js
│   │   ├── whatsapp.routes.js
│   │   ├── dashboard.routes.js
│   │   └── analytics.routes.js
│   ├── utils/
│   │   ├── errors.js             # Custom error classes
│   │   ├── response.js           # API response formatter
│   │   └── logger.js             # Winston logger setup
│   ├── database/
│   │   └── seed.js               # Database seeding
│   └── server.js                 # Application entry point
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Database migrations
│       ├── 001_initial_schema.sql
│       ├── 002_performance_views.sql
│       ├── 003_security_policies.sql
│       └── 004_order_status_log.sql
├── logs/                         # Application logs
├── tests/                        # Test files (future)
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
├── Dockerfile
├── docker-compose.yml
├── render.yaml                   # Render deployment config
└── README.md
```

## Core Components

### 1. Order Lifecycle Service
Manages the complete order flow from draft to completion:
- State machine with 8 statuses
- Automatic credit ledger updates
- Stock management
- WhatsApp notifications
- Audit logging

### 2. Credit Service
Handles all financial transactions:
- Append-only ledger
- Running balance calculation
- Credit score algorithm
- Payment processing
- Reversal handling

### 3. WhatsApp Service
Integrates with WhatsApp Business API:
- Message sending
- Webhook handling
- Order parsing from messages
- Status query handling
- Notification templates

### 4. Dashboard Service
Provides real-time insights:
- Admin dashboard (system-wide metrics)
- Vendor dashboard (order management)
- Retailer dashboard (order tracking)
- Performance metrics
- Credit risk analysis

### 5. Analytics Service
Advanced data analysis:
- Order trends
- Product performance
- Retailer behavior analysis
- Vendor fulfillment metrics
- Time-series data

## Data Flow

### Order Creation Flow
```
1. Retailer sends WhatsApp message
   ↓
2. WhatsApp webhook receives message
   ↓
3. WhatsAppOrderParser identifies retailer
   ↓
4. Parse order items from message
   ↓
5. Validate products and stock
   ↓
6. OrderLifecycleService creates DRAFT order
   ↓
7. Send confirmation to retailer
   ↓
8. Log status transition
```

### Order Acceptance Flow
```
1. Vendor accepts order
   ↓
2. Validate state transition (VENDOR_ASSIGNED → ACCEPTED)
   ↓
3. Reserve stock from inventory
   ↓
4. Create credit ledger entry (ORDER_CREDIT)
   ↓
5. Update retailer outstanding debt
   ↓
6. Send notifications
   ↓
7. Log status transition
```

### Payment Flow
```
1. Payment recorded by vendor/admin
   ↓
2. Validate payment amount
   ↓
3. Update order paid_amount and due_amount
   ↓
4. Create credit ledger entry (PAYMENT_DEBIT)
   ↓
5. Update retailer outstanding debt
   ↓
6. Update payment status
   ↓
7. Send confirmation to retailer
```

## Security Architecture

### Authentication
- JWT-based authentication
- Token expiration: 7 days (configurable)
- Password hashing: bcrypt with 12 rounds
- Secure token storage

### Authorization
- Role-based access control (RBAC)
- Four roles: ADMIN, OPERATOR, VENDOR, RETAILER
- Middleware-based authorization checks
- Row-level security in database

### Data Protection
- All financial records immutable
- Soft deletes for user data
- Audit logging for sensitive operations
- Input validation on all endpoints
- SQL injection protection (Prisma)
- XSS protection (Helmet)

## Performance Optimizations

### Database
- Composite indexes on frequently queried columns
- Descending indexes for recent data queries
- Materialized views for dashboard metrics
- Connection pooling (Prisma default: 10)
- Query optimization with EXPLAIN

### Application
- Response compression (gzip)
- Rate limiting (100 req/15min per IP)
- Efficient pagination
- Async operations for notifications
- Minimal data transfer

### Caching Strategy (Future)
- Redis for session storage
- Materialized view refresh every 6 hours
- Product catalog caching
- Dashboard metrics caching

## Scalability Considerations

### Current Capacity
- 1500 retailers
- 300 vendors
- 2000 concurrent users
- 10,000 orders/day

### Scaling Strategy
1. **Vertical Scaling**: Upgrade Render plan
2. **Read Replicas**: Separate read/write databases
3. **Caching Layer**: Redis for frequently accessed data
4. **Queue System**: Bull/BullMQ for background jobs
5. **CDN**: Static asset delivery
6. **Microservices**: Split services if needed

### Database Scaling
- Partitioning for large tables (audit_logs, whatsapp_messages)
- Archive old data (> 2 years)
- Read replicas for analytics queries
- Connection pooling optimization

## Monitoring & Observability

### Logging
- Winston for structured logging
- Log levels: error, warn, info, debug
- Separate files for errors and combined logs
- Log rotation (future)

### Metrics to Monitor
- Response time (p50, p95, p99)
- Error rate
- Database connection pool usage
- Order processing time
- Credit ledger balance accuracy
- WhatsApp message delivery rate

### Alerts
- Error rate > 1%
- Response time > 1s
- Database connections > 80%
- Disk space < 20%
- Failed WhatsApp messages

## Disaster Recovery

### Backup Strategy
- Daily full database backups
- Continuous WAL archiving
- Backup retention: 30 days
- Test restores monthly

### Recovery Procedures
1. Identify issue
2. Stop application if needed
3. Restore from latest backup
4. Replay WAL logs
5. Verify data integrity
6. Resume operations

### High Availability (Future)
- Multi-region deployment
- Database replication
- Automatic failover
- Load balancing

## Development Workflow

### Local Development
```bash
# Setup
npm install
npm run db:generate
npm run db:migrate
npm run db:seed

# Run
npm run dev

# Test
npm test
```

### Deployment
```bash
# Build
npm install
npx prisma generate

# Migrate
npx prisma migrate deploy

# Start
npm start
```

## Future Enhancements

### Phase 2
- [ ] Mobile app for retailers
- [ ] Vendor portal web interface
- [ ] Advanced analytics dashboard
- [ ] Automated credit limit adjustment
- [ ] SMS notifications backup
- [ ] Multi-language support (Nepali)

### Phase 3
- [ ] AI-powered demand forecasting
- [ ] Automated vendor selection
- [ ] Dynamic pricing
- [ ] Loyalty program
- [ ] Invoice generation
- [ ] Tax compliance automation

### Phase 4
- [ ] Integration with banks for loans
- [ ] Marketplace expansion
- [ ] Delivery tracking
- [ ] Quality ratings
- [ ] Dispute resolution system
- [ ] Advanced fraud detection
