-- Row-Level Security Policies for Multi-Tenant Isolation

-- Enable RLS on sensitive tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledgers ENABLE ROW LEVEL SECURITY;

-- Retailer can only see their own orders
CREATE POLICY retailer_orders_policy ON orders
    FOR SELECT
    USING (
        retailer_id IN (
            SELECT id FROM retailers 
            WHERE user_id = current_setting('app.user_id')::uuid
        )
    );

-- Vendor can only see orders for their products
CREATE POLICY vendor_orders_policy ON orders
    FOR SELECT
    USING (
        vendor_id IN (
            SELECT id FROM vendors 
            WHERE user_id = current_setting('app.user_id')::uuid
        )
    );

-- Admin can see all orders
CREATE POLICY admin_orders_policy ON orders
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = current_setting('app.user_id')::uuid 
            AND role IN ('ADMIN', 'OPERATOR')
        )
    );

-- Retailer can only see their own payments
CREATE POLICY retailer_payments_policy ON payments
    FOR SELECT
    USING (
        retailer_id IN (
            SELECT id FROM retailers 
            WHERE user_id = current_setting('app.user_id')::uuid
        )
    );

-- Vendor can only see payments for their orders
CREATE POLICY vendor_payments_policy ON payments
    FOR SELECT
    USING (
        vendor_id IN (
            SELECT id FROM vendors 
            WHERE user_id = current_setting('app.user_id')::uuid
        )
    );

-- Retailer can only see their own credit ledger
CREATE POLICY retailer_ledger_policy ON credit_ledgers
    FOR SELECT
    USING (
        retailer_id IN (
            SELECT id FROM retailers 
            WHERE user_id = current_setting('app.user_id')::uuid
        )
    );

-- Vendor can only see ledger entries for their transactions
CREATE POLICY vendor_ledger_policy ON credit_ledgers
    FOR SELECT
    USING (
        vendor_id IN (
            SELECT id FROM vendors 
            WHERE user_id = current_setting('app.user_id')::uuid
        )
    );

-- Function to set user context
CREATE OR REPLACE FUNCTION set_user_context(user_uuid uuid)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.user_id', user_uuid::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent DELETE on financial tables
CREATE OR REPLACE FUNCTION prevent_financial_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'DELETE operation not allowed on financial records. Use reversal instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_order_delete
    BEFORE DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER prevent_payment_delete
    BEFORE DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER prevent_ledger_delete
    BEFORE DELETE ON credit_ledgers
    FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

CREATE TRIGGER prevent_order_items_delete
    BEFORE DELETE ON order_items
    FOR EACH ROW EXECUTE FUNCTION prevent_financial_delete();

-- Audit trigger for sensitive operations
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        ip_address
    ) VALUES (
        current_setting('app.user_id', true)::uuid,
        TG_OP::text::"AuditAction",
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        inet_client_addr()
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers
CREATE TRIGGER audit_orders_changes
    AFTER INSERT OR UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

CREATE TRIGGER audit_payments_changes
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

CREATE TRIGGER audit_user_changes
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();
