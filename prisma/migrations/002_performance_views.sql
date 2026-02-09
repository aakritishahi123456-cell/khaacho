-- Materialized views for performance optimization

-- Retailer Statistics View
CREATE MATERIALIZED VIEW retailer_stats AS
SELECT 
    r.id as retailer_id,
    r.retailer_code,
    r.shop_name,
    r.credit_score,
    r.outstanding_debt,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT CASE WHEN o.status = 'DELIVERED' THEN o.id END) as delivered_orders,
    SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total ELSE 0 END) as total_revenue,
    AVG(CASE WHEN o.status = 'DELIVERED' THEN o.total END) as avg_order_value,
    MAX(o.created_at) as last_order_date,
    COUNT(DISTINCT CASE WHEN o.created_at >= NOW() - INTERVAL '30 days' THEN o.id END) as orders_last_30_days
FROM retailers r
LEFT JOIN orders o ON r.id = o.retailer_id
WHERE r.deleted_at IS NULL
GROUP BY r.id, r.retailer_code, r.shop_name, r.credit_score, r.outstanding_debt;

CREATE UNIQUE INDEX idx_retailer_stats_id ON retailer_stats(retailer_id);

-- Vendor Statistics View
CREATE MATERIALIZED VIEW vendor_stats AS
SELECT 
    v.id as vendor_id,
    v.vendor_code,
    u.business_name,
    v.rating,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT o.retailer_id) as unique_customers,
    SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total ELSE 0 END) as total_sales,
    AVG(CASE WHEN o.status = 'DELIVERED' THEN o.total END) as avg_order_value,
    COUNT(DISTINCT vp.product_id) as total_products,
    SUM(vp.stock) as total_stock_units
FROM vendors v
JOIN users u ON v.user_id = u.id
LEFT JOIN orders o ON v.id = o.vendor_id
LEFT JOIN vendor_products vp ON v.id = vp.vendor_id AND vp.is_available = true
WHERE v.deleted_at IS NULL
GROUP BY v.id, v.vendor_code, u.business_name, v.rating;

CREATE UNIQUE INDEX idx_vendor_stats_id ON vendor_stats(vendor_id);

-- Product Performance View
CREATE MATERIALIZED VIEW product_performance AS
SELECT 
    p.id as product_id,
    p.product_code,
    p.name,
    p.category,
    COUNT(DISTINCT oi.order_id) as times_ordered,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.total) as total_revenue,
    AVG(oi.unit_price) as avg_selling_price,
    MAX(oi.created_at) as last_ordered_at,
    COUNT(DISTINCT vp.vendor_id) as vendor_count,
    AVG(vp.stock) as avg_stock_level
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN vendor_products vp ON p.id = vp.product_id AND vp.is_available = true
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.product_code, p.name, p.category;

CREATE UNIQUE INDEX idx_product_performance_id ON product_performance(product_id);
CREATE INDEX idx_product_performance_revenue ON product_performance(total_revenue DESC);

-- Daily Order Summary View
CREATE MATERIALIZED VIEW daily_order_summary AS
SELECT 
    DATE(created_at) as order_date,
    COUNT(*) as total_orders,
    COUNT(DISTINCT retailer_id) as unique_retailers,
    COUNT(DISTINCT vendor_id) as unique_vendors,
    SUM(total) as total_value,
    AVG(total) as avg_order_value,
    COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) as delivered_orders,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_orders,
    SUM(CASE WHEN payment_status = 'PAID' THEN total ELSE 0 END) as paid_amount,
    SUM(CASE WHEN payment_status = 'PENDING' THEN total ELSE 0 END) as pending_amount
FROM orders
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

CREATE UNIQUE INDEX idx_daily_summary_date ON daily_order_summary(order_date);

-- Credit Risk View
CREATE MATERIALIZED VIEW credit_risk_analysis AS
SELECT 
    r.id as retailer_id,
    r.retailer_code,
    r.shop_name,
    r.credit_score,
    r.credit_limit,
    r.outstanding_debt,
    r.outstanding_debt / NULLIF(r.credit_limit, 0) * 100 as debt_utilization_pct,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT CASE WHEN o.payment_status = 'OVERDUE' THEN o.id END) as overdue_orders,
    SUM(CASE WHEN o.payment_status = 'OVERDUE' THEN o.due_amount ELSE 0 END) as overdue_amount,
    MAX(o.created_at) as last_order_date,
    EXTRACT(DAYS FROM NOW() - MAX(o.created_at)) as days_since_last_order,
    AVG(EXTRACT(DAYS FROM o.delivered_at - o.created_at)) as avg_delivery_days
FROM retailers r
LEFT JOIN orders o ON r.id = o.retailer_id
WHERE r.deleted_at IS NULL
GROUP BY r.id, r.retailer_code, r.shop_name, r.credit_score, r.credit_limit, r.outstanding_debt;

CREATE UNIQUE INDEX idx_credit_risk_id ON credit_risk_analysis(retailer_id);
CREATE INDEX idx_credit_risk_score ON credit_risk_analysis(credit_score);
CREATE INDEX idx_credit_risk_overdue ON credit_risk_analysis(overdue_amount DESC);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY retailer_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY product_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_order_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY credit_risk_analysis;
END;
$$ LANGUAGE plpgsql;

-- Schedule refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-stats', '0 */6 * * *', 'SELECT refresh_all_stats()');
