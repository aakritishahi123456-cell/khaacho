-- Performance indexes for high-volume operations
-- Optimized for 1500 retailers, 300 vendors, 5000 orders/day

-- Critical indexes for order queries (5000 orders/day = ~150,000 orders/month)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_retailer_status_date 
    ON orders(retailer_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_vendor_status_date 
    ON orders(vendor_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_status_date 
    ON orders(payment_status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_date 
    ON orders(status, created_at DESC);

-- Composite index for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_date_status_total 
    ON orders(created_at DESC, status) INCLUDE (total, paid_amount, due_amount);

-- Order items for fast order detail retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_product 
    ON order_items(order_id, product_id);

-- Credit ledger for balance calculations (critical for 1500 retailers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_ledger_retailer_vendor_date 
    ON credit_ledgers(retailer_id, vendor_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_ledger_balance 
    ON credit_ledgers(retailer_id, created_at DESC) INCLUDE (running_balance);

-- Payment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_retailer_date 
    ON payments(retailer_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_vendor_date 
    ON payments(vendor_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_status 
    ON payments(order_id, payment_status);

-- WhatsApp message processing (async queue)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_unprocessed 
    ON whatsapp_messages(is_processed, created_at) WHERE is_processed = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_from_date 
    ON whatsapp_messages(from_number, created_at DESC);

-- Retailer queries (1500 retailers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retailers_approved_debt 
    ON retailers(is_approved, outstanding_debt DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retailers_credit_score 
    ON retailers(credit_score DESC) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_retailers_last_order 
    ON retailers(last_order_at DESC) WHERE deleted_at IS NULL;

-- Vendor queries (300 vendors)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_approved_sales 
    ON vendors(is_approved, total_sales DESC) WHERE deleted_at IS NULL;

-- Product availability for order creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_products_available 
    ON vendor_products(vendor_id, is_available, stock) WHERE is_available = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendor_products_low_stock 
    ON vendor_products(vendor_id, stock) WHERE stock <= min_stock;

-- Audit logs (for compliance and debugging)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_date_action 
    ON audit_logs(created_at DESC, action);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_date 
    ON audit_logs(user_id, created_at DESC);

-- Order status logs for tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_status_logs_order_date 
    ON order_status_logs(order_id, created_at ASC);

-- Partial indexes for active records only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_role 
    ON users(role, is_active) WHERE deleted_at IS NULL AND is_active = true;

-- Statistics for query planner
ANALYZE orders;
ANALYZE order_items;
ANALYZE credit_ledgers;
ANALYZE payments;
ANALYZE retailers;
ANALYZE vendors;
ANALYZE whatsapp_messages;

-- Create function to refresh statistics periodically
CREATE OR REPLACE FUNCTION refresh_table_statistics()
RETURNS void AS $$
BEGIN
    ANALYZE orders;
    ANALYZE order_items;
    ANALYZE credit_ledgers;
    ANALYZE payments;
    ANALYZE retailers;
    ANALYZE vendors;
    ANALYZE whatsapp_messages;
    ANALYZE vendor_products;
END;
$$ LANGUAGE plpgsql;

-- Vacuum settings for high-volume tables
ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE order_items SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE credit_ledgers SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE whatsapp_messages SET (autovacuum_vacuum_scale_factor = 0.05);

-- Connection pooling recommendations
COMMENT ON DATABASE khaacho IS 'Recommended connection pool: min=10, max=50 for 5000 orders/day';
