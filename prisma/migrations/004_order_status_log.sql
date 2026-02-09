-- Order Status Log table for tracking all state transitions

CREATE TABLE order_status_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_status_logs_order ON order_status_logs(order_id, created_at);
CREATE INDEX idx_order_status_logs_status ON order_status_logs(to_status);
CREATE INDEX idx_order_status_logs_user ON order_status_logs(changed_by);

-- Update OrderStatus enum to include new statuses
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'VENDOR_ASSIGNED',
    'ACCEPTED',
    'DISPATCHED',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED'
);

-- Update orders table
ALTER TABLE orders 
    ALTER COLUMN status TYPE "OrderStatus" USING status::text::"OrderStatus";

-- Drop old enum
DROP TYPE "OrderStatus_old";

-- Add VendorProduct table if not exists (for many-to-many relationship)
CREATE TABLE IF NOT EXISTS vendor_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    vendor_price DECIMAL(12,2) NOT NULL,
    mrp DECIMAL(12,2) NOT NULL,
    discount DECIMAL(5,2) DEFAULT 0,
    stock INT DEFAULT 0,
    min_stock INT DEFAULT 0,
    max_stock INT,
    lead_time_days INT DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    last_restocked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(vendor_id, product_id)
);

CREATE INDEX idx_vendor_products_vendor ON vendor_products(vendor_id, is_available);
CREATE INDEX idx_vendor_products_product ON vendor_products(product_id);
CREATE INDEX idx_vendor_products_sku ON vendor_products(sku);
CREATE INDEX idx_vendor_products_stock ON vendor_products(stock);

-- Trigger for vendor_products updated_at
CREATE TRIGGER update_vendor_products_updated_at BEFORE UPDATE ON vendor_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get current order status
CREATE OR REPLACE FUNCTION get_order_current_status(order_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
    current_status VARCHAR;
BEGIN
    SELECT status INTO current_status
    FROM orders
    WHERE id = order_uuid;
    
    RETURN current_status;
END;
$$ LANGUAGE plpgsql;

-- Function to validate order status transition
CREATE OR REPLACE FUNCTION validate_order_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transitions TEXT[];
BEGIN
    -- Define valid transitions
    CASE OLD.status
        WHEN 'DRAFT' THEN
            valid_transitions := ARRAY['CONFIRMED', 'CANCELLED'];
        WHEN 'CONFIRMED' THEN
            valid_transitions := ARRAY['VENDOR_ASSIGNED', 'CANCELLED'];
        WHEN 'VENDOR_ASSIGNED' THEN
            valid_transitions := ARRAY['ACCEPTED', 'CANCELLED'];
        WHEN 'ACCEPTED' THEN
            valid_transitions := ARRAY['DISPATCHED', 'CANCELLED'];
        WHEN 'DISPATCHED' THEN
            valid_transitions := ARRAY['DELIVERED', 'CANCELLED'];
        WHEN 'DELIVERED' THEN
            valid_transitions := ARRAY['COMPLETED', 'CANCELLED'];
        WHEN 'COMPLETED' THEN
            valid_transitions := ARRAY[]::TEXT[];
        WHEN 'CANCELLED' THEN
            valid_transitions := ARRAY[]::TEXT[];
        ELSE
            valid_transitions := ARRAY[]::TEXT[];
    END CASE;

    -- Check if new status is valid
    IF NOT (NEW.status::TEXT = ANY(valid_transitions)) AND OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply transition validation trigger
CREATE TRIGGER validate_order_status_transition
    BEFORE UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_order_transition();

-- Trigger to automatically log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_logs (
            order_id,
            from_status,
            to_status,
            changed_by,
            notes
        ) VALUES (
            NEW.id,
            OLD.status::TEXT,
            NEW.status::TEXT,
            current_setting('app.user_id', true)::UUID,
            'Status changed via trigger'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_log_order_status_change
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_order_status_change();
