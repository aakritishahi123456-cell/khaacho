# Production-Grade Database Schema Documentation

## Overview
This schema is designed for 2000+ concurrent users with immutable financial records, comprehensive audit trails, and optimized query performance.

## Core Principles

### 1. Financial Immutability
- **No DELETE operations** on financial tables (orders, payments, credit_ledgers)
- All corrections done via **reversal entries**
- Complete audit trail maintained
- `ON DELETE RESTRICT` for financial foreign keys

### 2. Performance Optimization
- **Composite indexes** on frequently queried columns
- **Descending indexes** on timestamp columns for recent data queries
- **GIN indexes** for full-text search on product names
- **Partial indexes** on soft-deleted records
- **JSONB** for flexible metadata storage

### 3. Data Integrity
- **CHECK constraints** on amounts and scores
- **UNIQUE constraints** on business identifiers
- **Foreign key constraints** with appropriate cascade rules
- **Soft deletes** for user-facing data

## Table Structure

### Users Table
**Purpose**: Central authentication and user management

**Key Fields**:
- `role`: ADMIN, OPERATOR, VENDOR, RETAILER
- `deleted_at`: Soft delete timestamp
- `last_login_at`: Track user activity

**Indexes**:
- `(role, is_active)` - Fast role-based queries
- `(phone_number)` - Unique login identifier
- `(deleted_at)` - Partial index for soft deletes

### Vendors Table
**Purpose**: Vendor/wholesaler profiles

**Key Fields**:
- `vendor_code`: Unique business identifier
- `credit_limit`: Maximum credit allowed
- `total_sales`: Aggregate sales tracking
- `is_approved`: Approval workflow

**Indexes**:
- `(is_approved, deleted_at)` - Active vendor queries
- `(vendor_code)` - Fast lookups

### Retailers Table
**Purpose**: Retailer/shop profiles with credit scoring

**Key Fields**:
- `credit_score`: 300-900 range (CHECK constraint)
- `available_credit`: Real-time credit availability
- `outstanding_debt`: Current debt amount
- `risk_category`: HIGH, MEDIUM, LOW

**Indexes**:
- `(outstanding_debt)` - Collections queries
- `(credit_score)` - Risk assessment
- `(last_order_at)` - Activity tracking

### Products Table
**Purpose**: Master product catalog

**Key Fields**:
- `product_code`: Unique product identifier
- `hsn_code`: Tax classification
- `barcode`: Retail barcode

**Indexes**:
- `(category, sub_category)` - Category browsing
- `GIN(name)` - Full-text search with pg_trgm

### Vendor Products Table
**Purpose**: Vendor-specific pricing and inventory

**Key Fields**:
- `sku`: Vendor-specific SKU
- `vendor_price`: Vendor's selling price
- `stock`: Current inventory
- `is_available`: Availability flag

**Indexes**:
- `(vendor_id, is_available)` - Available products per vendor
- `(stock)` - Low stock alerts

### Orders Table (IMMUTABLE)
**Purpose**: Order records with complete lifecycle

**Key Fields**:
- `order_number`: Human-readable order ID
- `invoice_number`: Tax invoice number
- `credit_used`: Credit applied to order
- `cancelled_at`: Cancellation timestamp

**Indexes**:
- `(retailer_id, created_at DESC)` - Retailer order history
- `(vendor_id, created_at DESC)` - Vendor order processing
- `(status, payment_status)` - Dashboard queries

**Immutability**: `ON DELETE RESTRICT` prevents deletion

### Order Items Table (IMMUTABLE)
**Purpose**: Line items with product snapshots

**Key Fields**:
- `product_name`: Snapshot at order time
- `product_sku`: Snapshot at order time
- `tax_rate`: Applied tax rate
- `tax_amount`: Calculated tax

**Why Snapshots**: Preserves historical pricing even if product changes

### Payments Table (IMMUTABLE)
**Purpose**: Payment records with reconciliation

**Key Fields**:
- `payment_number`: Unique payment ID
- `payment_method`: CASH, BANK_TRANSFER, etc.
- `transaction_id`: External payment gateway ID
- `is_reversed`: Reversal flag
- `reversal_reason`: Why payment was reversed

**Indexes**:
- `(retailer_id, created_at DESC)` - Payment history
- `(transaction_id)` - Gateway reconciliation
- `(is_reversed)` - Reversal tracking

### Credit Ledger Table (IMMUTABLE - APPEND ONLY)
**Purpose**: Complete financial transaction log

**Key Fields**:
- `ledger_number`: Sequential ledger entry ID
- `transaction_type`: ORDER_CREDIT, PAYMENT_DEBIT, etc.
- `running_balance`: Balance after this transaction
- `previous_balance`: Balance before this transaction
- `is_reversed`: Reversal flag
- `reversal_ledger_id`: Links to reversal entry

**Balance Calculation**:
```sql
-- Current balance is always the latest running_balance
SELECT running_balance 
FROM credit_ledgers 
WHERE retailer_id = ? AND vendor_id = ?
ORDER BY created_at DESC 
LIMIT 1;
```

**Indexes**:
- `(retailer_id, created_at DESC)` - Fast balance lookup
- `(due_date)` - Overdue tracking

### WhatsApp Messages Table
**Purpose**: Message logging and processing

**Key Fields**:
- `message_id`: WhatsApp message ID
- `conversation_id`: Thread grouping
- `direction`: INBOUND, OUTBOUND
- `is_processed`: Processing flag

**Indexes**:
- `(from_number, created_at DESC)` - Conversation history
- `(is_processed)` - Processing queue

### Audit Logs Table (IMMUTABLE)
**Purpose**: Complete system audit trail

**Key Fields**:
- `action`: CREATE, UPDATE, DELETE, etc.
- `old_values`: JSONB of previous state
- `new_values`: JSONB of new state
- `ip_address`: INET type for IP tracking

**Indexes**:
- `(user_id, created_at DESC)` - User activity
- `(entity_type, entity_id)` - Entity history

**Partitioning**: Consider monthly partitions for large datasets

## Query Optimization Strategies

### 1. Recent Data Queries
```sql
-- Optimized with DESC index
SELECT * FROM orders 
WHERE retailer_id = ? 
ORDER BY created_at DESC 
LIMIT 20;
```

### 2. Balance Calculation
```sql
-- Single row lookup (no SUM needed)
SELECT running_balance 
FROM credit_ledgers 
WHERE retailer_id = ? AND vendor_id = ?
ORDER BY created_at DESC 
LIMIT 1;
```

### 3. Product Search
```sql
-- Uses GIN index with pg_trgm
SELECT * FROM products 
WHERE name ILIKE '%rice%' 
AND is_active = true;
```

### 4. Dashboard Aggregates
```sql
-- Materialized view for dashboard
CREATE MATERIALIZED VIEW retailer_stats AS
SELECT 
    retailer_id,
    COUNT(*) as total_orders,
    SUM(total) as total_spent,
    AVG(total) as avg_order_value
FROM orders
WHERE status = 'DELIVERED'
GROUP BY retailer_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY retailer_stats;
```

## Immutability Implementation

### Financial Record Protection
```sql
-- Prevent DELETE on financial tables
REVOKE DELETE ON orders FROM app_user;
REVOKE DELETE ON payments FROM app_user;
REVOKE DELETE ON credit_ledgers FROM app_user;
REVOKE DELETE ON order_items FROM app_user;

-- Only allow INSERT and UPDATE
GRANT SELECT, INSERT, UPDATE ON orders TO app_user;
```

### Reversal Pattern
```sql
-- Original payment
INSERT INTO payments (amount, ...) VALUES (1000, ...);
INSERT INTO credit_ledgers (transaction_type, amount, running_balance) 
VALUES ('PAYMENT_DEBIT', 1000, 5000);

-- Reversal (if needed)
UPDATE payments SET is_reversed = true WHERE id = ?;
INSERT INTO credit_ledgers (
    transaction_type, 
    amount, 
    running_balance,
    reversal_ledger_id
) VALUES (
    'ADJUSTMENT_CREDIT', 
    1000, 
    6000,
    ?
);
```

## Scaling Considerations

### Connection Pooling
```javascript
// Prisma connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 100
}
```

### Read Replicas
- Route read queries to replicas
- Write queries to primary
- Use `?connection_limit=50` in replica URLs

### Partitioning Strategy
```sql
-- Partition audit_logs by month
CREATE TABLE audit_logs (
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### Archival Strategy
- Archive orders older than 2 years to separate table
- Keep credit_ledgers indefinitely (legal requirement)
- Compress old WhatsApp messages

## Monitoring Queries

### Slow Query Detection
```sql
-- Enable pg_stat_statements
CREATE EXTENSION pg_stat_statements;

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Index Usage
```sql
-- Check unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Table Bloat
```sql
-- Check table bloat
SELECT 
    schemaname, 
    tablename, 
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Backup Strategy

1. **Daily full backups** with pg_dump
2. **Continuous WAL archiving** for point-in-time recovery
3. **Replica for disaster recovery**
4. **Test restores monthly**

## Security

1. **Row-level security** for multi-tenant isolation
2. **Encrypted connections** (SSL/TLS)
3. **Separate read-only user** for analytics
4. **Audit all schema changes**
