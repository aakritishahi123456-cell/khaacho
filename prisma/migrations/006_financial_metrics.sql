-- Financial Metrics Table for Retailer Behavior Analysis
-- All metrics are calculated automatically from order and payment history
-- No manual editing allowed - all updates via triggers and functions

CREATE TABLE retailer_financial_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID NOT NULL UNIQUE REFERENCES retailers(id) ON DELETE CASCADE,
    
    -- Order metrics
    total_orders_last_30_days INT DEFAULT 0,
    total_orders_lifetime INT DEFAULT 0,
    total_purchase_value DECIMAL(15,2) DEFAULT 0,
    average_order_value DECIMAL(15,2) DEFAULT 0,
    
    -- Payment behavior metrics
    payment_delay_average_days DECIMAL(8,2) DEFAULT 0,
    on_time_payment_ratio DECIMAL(5,2) DEFAULT 0,
    total_payments_made INT DEFAULT 0,
    on_time_payments INT DEFAULT 0,
    late_payments INT DEFAULT 0,
    
    -- Credit metrics
    outstanding_credit DECIMAL(15,2) DEFAULT 0,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    credit_utilization_percentage DECIMAL(5,2) DEFAULT 0,
    available_credit DECIMAL(15,2) DEFAULT 0,
    
    -- Frequency metrics
    order_frequency_per_week DECIMAL(8,2) DEFAULT 0,
    days_since_first_order INT DEFAULT 0,
    days_since_last_order INT,
    
    -- Timestamps
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_on_time_ratio CHECK (on_time_payment_ratio >= 0 AND on_time_payment_ratio <= 100),
    CONSTRAINT chk_credit_utilization CHECK (credit_utilization_percentage >= 0 AND credit_utilization_percentage <= 100)
);

-- Indexes for performance
CREATE INDEX idx_financial_metrics_retailer ON retailer_financial_metrics(retailer_id);
CREATE INDEX idx_financial_metrics_credit_util ON retailer_financial_metrics(credit_utilization_percentage DESC);
CREATE INDEX idx_financial_metrics_payment_ratio ON retailer_financial_metrics(on_time_payment_ratio DESC);
CREATE INDEX idx_financial_metrics_last_calculated ON retailer_financial_metrics(last_calculated_at);

-- Function to calculate all financial metrics for a retailer
CREATE OR REPLACE FUNCTION calculate_retailer_financial_metrics(p_retailer_id UUID)
RETURNS void AS $$
DECLARE
    v_total_orders_30d INT;
    v_total_orders_lifetime INT;
    v_total_purchase_value DECIMAL(15,2);
    v_avg_order_value DECIMAL(15,2);
    v_payment_delay_avg DECIMAL(8,2);
    v_on_time_ratio DECIMAL(5,2);
    v_total_payments INT;
    v_on_time_payments INT;
    v_late_payments INT;
    v_outstanding_credit DECIMAL(15,2);
    v_credit_limit DECIMAL(15,2);
    v_credit_utilization DECIMAL(5,2);
    v_available_credit DECIMAL(15,2);
    v_order_frequency DECIMAL(8,2);
    v_days_since_first INT;
    v_days_since_last INT;
    v_first_order_date TIMESTAMP;
    v_last_order_date TIMESTAMP;
BEGIN
    -- Get retailer credit info
    SELECT credit_limit, outstanding_debt, available_credit
    INTO v_credit_limit, v_outstanding_credit, v_available_credit
    FROM retailers
    WHERE id = p_retailer_id;
    
    -- Calculate credit utilization
    IF v_credit_limit > 0 THEN
        v_credit_utilization := (v_outstanding_credit / v_credit_limit) * 100;
    ELSE
        v_credit_utilization := 0;
    END IF;
    
    -- Orders in last 30 days
    SELECT COUNT(*)
    INTO v_total_orders_30d
    FROM orders
    WHERE retailer_id = p_retailer_id
    AND created_at >= NOW() - INTERVAL '30 days'
    AND status IN ('DELIVERED', 'COMPLETED');
    
    -- Lifetime orders
    SELECT COUNT(*)
    INTO v_total_orders_lifetime
    FROM orders
    WHERE retailer_id = p_retailer_id
    AND status IN ('DELIVERED', 'COMPLETED');
    
    -- Total purchase value (completed orders only)
    SELECT COALESCE(SUM(total), 0)
    INTO v_total_purchase_value
    FROM orders
    WHERE retailer_id = p_retailer_id
    AND status IN ('DELIVERED', 'COMPLETED');
    
    -- Average order value
    IF v_total_orders_lifetime > 0 THEN
        v_avg_order_value := v_total_purchase_value / v_total_orders_lifetime;
    ELSE
        v_avg_order_value := 0;
    END IF;
    
    -- Payment behavior metrics
    WITH payment_delays AS (
        SELECT 
            o.id,
            o.delivered_at,
            MIN(p.created_at) as first_payment_date,
            EXTRACT(DAYS FROM (MIN(p.created_at) - o.delivered_at)) as delay_days
        FROM orders o
        LEFT JOIN payments p ON o.id = p.order_id
        WHERE o.retailer_id = p_retailer_id
        AND o.status IN ('DELIVERED', 'COMPLETED')
        AND o.delivered_at IS NOT NULL
        GROUP BY o.id, o.delivered_at
    )
    SELECT 
        COUNT(*),
        COALESCE(AVG(delay_days), 0),
        COUNT(CASE WHEN delay_days <= 7 THEN 1 END),
        COUNT(CASE WHEN delay_days > 7 THEN 1 END)
    INTO v_total_payments, v_payment_delay_avg, v_on_time_payments, v_late_payments
    FROM payment_delays
    WHERE first_payment_date IS NOT NULL;
    
    -- On-time payment ratio
    IF v_total_payments > 0 THEN
        v_on_time_ratio := (v_on_time_payments::DECIMAL / v_total_payments) * 100;
    ELSE
        v_on_time_ratio := 0;
    END IF;
    
    -- Order frequency calculation
    SELECT 
        MIN(created_at),
        MAX(created_at)
    INTO v_first_order_date, v_last_order_date
    FROM orders
    WHERE retailer_id = p_retailer_id
    AND status IN ('DELIVERED', 'COMPLETED');
    
    IF v_first_order_date IS NOT NULL THEN
        v_days_since_first := EXTRACT(DAYS FROM (NOW() - v_first_order_date));
        
        IF v_last_order_date IS NOT NULL THEN
            v_days_since_last := EXTRACT(DAYS FROM (NOW() - v_last_order_date));
        END IF;
        
        -- Calculate orders per week
        IF v_days_since_first > 0 THEN
            v_order_frequency := (v_total_orders_lifetime::DECIMAL / v_days_since_first) * 7;
        ELSE
            v_order_frequency := 0;
        END IF;
    ELSE
        v_days_since_first := 0;
        v_days_since_last := NULL;
        v_order_frequency := 0;
    END IF;
    
    -- Insert or update metrics
    INSERT INTO retailer_financial_metrics (
        retailer_id,
        total_orders_last_30_days,
        total_orders_lifetime,
        total_purchase_value,
        average_order_value,
        payment_delay_average_days,
        on_time_payment_ratio,
        total_payments_made,
        on_time_payments,
        late_payments,
        outstanding_credit,
        credit_limit,
        credit_utilization_percentage,
        available_credit,
        order_frequency_per_week,
        days_since_first_order,
        days_since_last_order,
        last_calculated_at,
        updated_at
    ) VALUES (
        p_retailer_id,
        v_total_orders_30d,
        v_total_orders_lifetime,
        v_total_purchase_value,
        v_avg_order_value,
        v_payment_delay_avg,
        v_on_time_ratio,
        v_total_payments,
        v_on_time_payments,
        v_late_payments,
        v_outstanding_credit,
        v_credit_limit,
        v_credit_utilization,
        v_available_credit,
        v_order_frequency,
        v_days_since_first,
        v_days_since_last,
        NOW(),
        NOW()
    )
    ON CONFLICT (retailer_id) DO UPDATE SET
        total_orders_last_30_days = EXCLUDED.total_orders_last_30_days,
        total_orders_lifetime = EXCLUDED.total_orders_lifetime,
        total_purchase_value = EXCLUDED.total_purchase_value,
        average_order_value = EXCLUDED.average_order_value,
        payment_delay_average_days = EXCLUDED.payment_delay_average_days,
        on_time_payment_ratio = EXCLUDED.on_time_payment_ratio,
        total_payments_made = EXCLUDED.total_payments_made,
        on_time_payments = EXCLUDED.on_time_payments,
        late_payments = EXCLUDED.late_payments,
        outstanding_credit = EXCLUDED.outstanding_credit,
        credit_limit = EXCLUDED.credit_limit,
        credit_utilization_percentage = EXCLUDED.credit_utilization_percentage,
        available_credit = EXCLUDED.available_credit,
        order_frequency_per_week = EXCLUDED.order_frequency_per_week,
        days_since_first_order = EXCLUDED.days_since_first_order,
        days_since_last_order = EXCLUDED.days_since_last_order,
        last_calculated_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update metrics after order status change
CREATE OR REPLACE FUNCTION trigger_update_metrics_on_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Only recalculate if order reaches DELIVERED or COMPLETED status
    IF NEW.status IN ('DELIVERED', 'COMPLETED') AND 
       (OLD.status IS NULL OR OLD.status NOT IN ('DELIVERED', 'COMPLETED')) THEN
        PERFORM calculate_retailer_financial_metrics(NEW.retailer_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_metrics_on_order_status
    AFTER UPDATE OF status ON orders
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_metrics_on_order();

-- Trigger to update metrics after payment
CREATE OR REPLACE FUNCTION trigger_update_metrics_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_retailer_id UUID;
BEGIN
    -- Get retailer_id from the payment
    SELECT retailer_id INTO v_retailer_id FROM payments WHERE id = NEW.id;
    
    IF v_retailer_id IS NOT NULL THEN
        PERFORM calculate_retailer_financial_metrics(v_retailer_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_metrics_on_payment
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_metrics_on_payment();

-- Trigger to update metrics when retailer credit limit changes
CREATE OR REPLACE FUNCTION trigger_update_metrics_on_retailer()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.credit_limit != OLD.credit_limit OR 
       NEW.outstanding_debt != OLD.outstanding_debt THEN
        PERFORM calculate_retailer_financial_metrics(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_metrics_on_retailer_change
    AFTER UPDATE OF credit_limit, outstanding_debt ON retailers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_metrics_on_retailer();

-- Function to recalculate all retailer metrics (for batch updates)
CREATE OR REPLACE FUNCTION recalculate_all_retailer_metrics()
RETURNS TABLE(retailer_id UUID, success BOOLEAN) AS $$
DECLARE
    v_retailer RECORD;
BEGIN
    FOR v_retailer IN SELECT id FROM retailers WHERE deleted_at IS NULL LOOP
        BEGIN
            PERFORM calculate_retailer_financial_metrics(v_retailer.id);
            retailer_id := v_retailer.id;
            success := TRUE;
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            retailer_id := v_retailer.id;
            success := FALSE;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Prevent manual updates to metrics table
CREATE OR REPLACE FUNCTION prevent_manual_metrics_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Manual updates to financial metrics are not allowed. Metrics are calculated automatically.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_manual_update
    BEFORE UPDATE ON retailer_financial_metrics
    FOR EACH ROW
    WHEN (current_setting('app.allow_metrics_update', true) IS NULL OR 
          current_setting('app.allow_metrics_update', true) != 'true')
    EXECUTE FUNCTION prevent_manual_metrics_update();

-- Initialize metrics for existing retailers
INSERT INTO retailer_financial_metrics (retailer_id)
SELECT id FROM retailers WHERE deleted_at IS NULL
ON CONFLICT (retailer_id) DO NOTHING;

-- Calculate initial metrics for all retailers
SELECT recalculate_all_retailer_metrics();

COMMENT ON TABLE retailer_financial_metrics IS 'Automatically calculated financial metrics for retailers. Do not update manually.';
COMMENT ON FUNCTION calculate_retailer_financial_metrics IS 'Calculates all financial metrics for a retailer from order and payment history';
