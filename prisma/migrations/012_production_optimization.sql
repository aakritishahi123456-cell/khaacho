-- Migration: Production Database Optimization
-- Description: Add critical indexes, optimize queries, and prepare for high-load production

-- ============================================================================
-- CRITICAL INDEXES FOR HIGH-TRAFFIC QUERIES
-- ============================================================================

-- Orders table - Most queried table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_retailer_status_created 
ON orders(retailer_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_vendor_status_created 
ON orders(vendor_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_payment_created 
ON orders(status, payment_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at_desc 
ON orders(created_at DESC) WHERE deleted_at IS NULL;

-- Credit ledgers - Financial queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_ledgers_retailer_created 
ON credit_ledgers(retailer_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_ledgers_vendor_created 
ON credit_ledgers(vendor_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_ledgers_type_created 
ON credit_ledgers(transaction_type, created_at DESC);

-- Payments table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_retailer_status_created 
ON payments(retailer_id, payment_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_vendor_created 
ON payments(vendor_id, created_at DESC);

-- Vendor products - Product searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_products_product_available 
ON vendor_products(product_id, is_available) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_products_vendor_available 
ON vendor_products(vendor_id, is_available) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_products_price 
ON vendor_products(vendor_price) WHERE is_available = TRUE AND deleted_at IS NULL;

-- WhatsApp messages - Communication tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_from_created 
ON whatsapp_messages(from, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_processed_created 
ON whatsapp_messages(is_processed, created_at DESC);

-- Audit logs - Compliance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_created 
ON audit_logs(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity_created 
ON audit_logs(entity_type, entity_id, created_at DESC);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================================================

-- Retailer financial metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retailers_credit_score_active 
ON retailers(credit_score DESC, is_approved) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retailers_outstanding_debt 
ON retailers(outstanding_debt DESC) WHERE deleted_at IS NULL AND outstanding_debt > 0;

-- Vendor performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_rating_approved 
ON vendors(rating DESC, is_approved) WHERE deleted_at IS NULL;

-- Products search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_active 
ON products(category, sub_category, is_active) WHERE deleted_at IS NULL;

-- ============================================================================
-- PARTIAL INDEXES FOR SPECIFIC QUERIES
-- ============================================================================

-- Active orders only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active 
ON orders(created_at DESC) 
WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND deleted_at IS NULL;

-- Overdue payments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_overdue 
ON orders(retailer_id, due_amount, created_at DESC) 
WHERE payment_status = 'OVERDUE';

-- Pending vendor acceptances
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_acceptances_pending 
ON vendor_order_acceptances(vendor_id, created_at DESC) 
WHERE status = 'pending';

-- Unprocessed WhatsApp messages
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_unprocessed 
ON whatsapp_messages(created_at DESC) 
WHERE is_processed = FALSE;

-- ============================================================================
-- COVERING INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Order list with essential fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_list_covering 
ON orders(retailer_id, created_at DESC) 
INCLUDE (order_number, status, payment_status, total, due_amount);

-- Product list with pricing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_products_list_covering 
ON vendor_products(vendor_id, is_available) 
INCLUDE (product_id, vendor_price, stock) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- TEXT SEARCH INDEXES
-- ============================================================================

-- Product name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm 
ON products USING gin(name gin_trgm_ops);

-- User name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name_trgm 
ON users USING gin(name gin_trgm_ops);

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE orders;
ANALYZE order_items;
ANALYZE retailers;
ANALYZE vendors;
ANALYZE products;
ANALYZE vendor_products;
ANALYZE credit_ledgers;
ANALYZE payments;
ANALYZE whatsapp_messages;
ANALYZE audit_logs;

-- ============================================================================
-- VACUUM TABLES TO RECLAIM SPACE
-- ============================================================================

VACUUM ANALYZE orders;
VACUUM ANALYZE credit_ledgers;
VACUUM ANALYZE payments;

-- ============================================================================
-- DATABASE STATISTICS
-- ============================================================================

-- Update statistics for better query planning
ALTER TABLE orders SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE credit_ledgers SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE payments SET (autovacuum_analyze_scale_factor = 0.05);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_orders_retailer_status_created IS 'Optimizes retailer order list queries';
COMMENT ON INDEX idx_orders_vendor_status_created IS 'Optimizes vendor order list queries';
COMMENT ON INDEX idx_orders_active IS 'Partial index for active orders only';
COMMENT ON INDEX idx_orders_overdue IS 'Partial index for overdue payment queries';
COMMENT ON INDEX idx_credit_ledgers_retailer_created IS 'Optimizes retailer transaction history';
COMMENT ON INDEX idx_vendor_products_product_available IS 'Optimizes product availability checks';

-- ============================================================================
-- QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Enable pg_stat_statements for query monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create view for slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    stddev_exec_time,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 100 -- queries taking more than 100ms
ORDER BY mean_exec_time DESC
LIMIT 50;

-- ============================================================================
-- INDEX USAGE STATISTICS
-- ============================================================================

CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- ============================================================================
-- TABLE BLOAT MONITORING
-- ============================================================================

CREATE OR REPLACE VIEW table_bloat_stats AS
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
    n_live_tup as live_tuples,
    n_dead_tup as dead_tuples,
    ROUND(100 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tuple_percent
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- MISSING INDEXES DETECTION
-- ============================================================================

CREATE OR REPLACE VIEW missing_indexes AS
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_tup_read / NULLIF(seq_scan, 0) as avg_seq_tup_read,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND idx_scan < seq_scan
  AND pg_relation_size(schemaname||'.'||tablename) > 1000000 -- Tables larger than 1MB
ORDER BY seq_tup_read DESC;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Production optimization migration completed successfully';
    RAISE NOTICE 'Created % indexes for high-performance queries', 
        (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%');
    RAISE NOTICE 'Run EXPLAIN ANALYZE on your queries to verify index usage';
END $$;
