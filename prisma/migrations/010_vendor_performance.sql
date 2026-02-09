-- Migration: Vendor Performance Tracking
-- Description: Track vendor performance metrics and reliability scores

-- Vendor Performance Metrics Table
CREATE TABLE IF NOT EXISTS vendor_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Core Metrics
    total_orders_assigned INTEGER DEFAULT 0,
    orders_accepted INTEGER DEFAULT 0,
    orders_rejected INTEGER DEFAULT 0,
    orders_completed INTEGER DEFAULT 0,
    orders_cancelled INTEGER DEFAULT 0,
    
    -- Acceptance Rate (%)
    acceptance_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Delivery Completion Rate (%)
    completion_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Average Fulfillment Time (hours)
    avg_fulfillment_time DECIMAL(8,2) DEFAULT 0.00,
    total_fulfillment_time DECIMAL(12,2) DEFAULT 0.00,
    
    -- Cancellation Rate (%)
    cancellation_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Price Competitiveness Index (0-100)
    price_competitiveness_index DECIMAL(5,2) DEFAULT 50.00,
    avg_price_deviation DECIMAL(8,2) DEFAULT 0.00, -- % deviation from market avg
    
    -- Reliability Score (0-100)
    reliability_score DECIMAL(5,2) DEFAULT 50.00,
    
    -- Quality Metrics
    quality_rating DECIMAL(3,2) DEFAULT 3.00, -- 1-5 scale
    customer_complaints INTEGER DEFAULT 0,
    
    -- Time Metrics
    avg_response_time DECIMAL(8,2) DEFAULT 0.00, -- hours to accept/reject
    on_time_deliveries INTEGER DEFAULT 0,
    late_deliveries INTEGER DEFAULT 0,
    
    -- Financial Metrics
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    avg_order_value DECIMAL(10,2) DEFAULT 0.00,
    
    -- Period Tracking
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculation_period VARCHAR(20) DEFAULT 'all_time', -- all_time, last_30_days, last_90_days
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(vendor_id, calculation_period)
);

-- Vendor Performance History (for trend analysis)
CREATE TABLE IF NOT EXISTS vendor_performance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Snapshot of metrics
    acceptance_rate DECIMAL(5,2),
    completion_rate DECIMAL(5,2),
    avg_fulfillment_time DECIMAL(8,2),
    cancellation_rate DECIMAL(5,2),
    price_competitiveness_index DECIMAL(5,2),
    reliability_score DECIMAL(5,2),
    
    -- Period info
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'monthly', -- daily, weekly, monthly, quarterly
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Performance Events (detailed tracking)
CREATE TABLE IF NOT EXISTS vendor_performance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    event_type VARCHAR(50) NOT NULL, -- order_assigned, order_accepted, order_rejected, order_completed, order_cancelled, delivery_late, delivery_on_time
    event_data JSONB, -- Additional event details
    
    -- Metrics impact
    affects_acceptance BOOLEAN DEFAULT FALSE,
    affects_completion BOOLEAN DEFAULT FALSE,
    affects_fulfillment_time BOOLEAN DEFAULT FALSE,
    affects_cancellation BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Price Comparison (for competitiveness index)
CREATE TABLE IF NOT EXISTS vendor_price_comparison (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    vendor_price DECIMAL(10,2) NOT NULL,
    market_avg_price DECIMAL(10,2),
    price_deviation DECIMAL(8,2), -- % deviation from market avg
    
    is_competitive BOOLEAN DEFAULT TRUE, -- within 10% of market avg
    
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id, vendor_id)
);

-- Indexes for performance
CREATE INDEX idx_vendor_performance_vendor ON vendor_performance(vendor_id);
CREATE INDEX idx_vendor_performance_reliability ON vendor_performance(reliability_score DESC);
CREATE INDEX idx_vendor_performance_history_vendor ON vendor_performance_history(vendor_id);
CREATE INDEX idx_vendor_performance_history_period ON vendor_performance_history(period_start, period_end);
CREATE INDEX idx_vendor_performance_events_vendor ON vendor_performance_events(vendor_id);
CREATE INDEX idx_vendor_performance_events_type ON vendor_performance_events(event_type);
CREATE INDEX idx_vendor_performance_events_created ON vendor_performance_events(created_at DESC);
CREATE INDEX idx_vendor_price_comparison_product ON vendor_price_comparison(product_id);
CREATE INDEX idx_vendor_price_comparison_vendor ON vendor_price_comparison(vendor_id);

-- Function to calculate vendor reliability score
CREATE OR REPLACE FUNCTION calculate_vendor_reliability_score(
    p_acceptance_rate DECIMAL,
    p_completion_rate DECIMAL,
    p_avg_fulfillment_time DECIMAL,
    p_cancellation_rate DECIMAL,
    p_price_competitiveness DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    v_score DECIMAL;
    v_acceptance_score DECIMAL;
    v_completion_score DECIMAL;
    v_fulfillment_score DECIMAL;
    v_cancellation_score DECIMAL;
    v_price_score DECIMAL;
BEGIN
    -- Acceptance Rate Score (25% weight)
    v_acceptance_score := p_acceptance_rate * 0.25;
    
    -- Completion Rate Score (30% weight)
    v_completion_score := p_completion_rate * 0.30;
    
    -- Fulfillment Time Score (20% weight)
    -- Assume ideal fulfillment time is 24 hours, max acceptable is 72 hours
    IF p_avg_fulfillment_time <= 24 THEN
        v_fulfillment_score := 100 * 0.20;
    ELSIF p_avg_fulfillment_time >= 72 THEN
        v_fulfillment_score := 0;
    ELSE
        v_fulfillment_score := ((72 - p_avg_fulfillment_time) / 48) * 100 * 0.20;
    END IF;
    
    -- Cancellation Rate Score (15% weight) - inverse
    v_cancellation_score := (100 - p_cancellation_rate) * 0.15;
    
    -- Price Competitiveness Score (10% weight)
    v_price_score := p_price_competitiveness * 0.10;
    
    -- Total Score
    v_score := v_acceptance_score + v_completion_score + v_fulfillment_score + 
               v_cancellation_score + v_price_score;
    
    -- Ensure score is between 0 and 100
    IF v_score > 100 THEN
        v_score := 100;
    ELSIF v_score < 0 THEN
        v_score := 0;
    END IF;
    
    RETURN ROUND(v_score, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update vendor performance metrics
CREATE OR REPLACE FUNCTION update_vendor_performance_metrics(p_vendor_id UUID)
RETURNS void AS $$
DECLARE
    v_total_assigned INTEGER;
    v_accepted INTEGER;
    v_rejected INTEGER;
    v_completed INTEGER;
    v_cancelled INTEGER;
    v_acceptance_rate DECIMAL;
    v_completion_rate DECIMAL;
    v_cancellation_rate DECIMAL;
    v_avg_fulfillment DECIMAL;
    v_price_index DECIMAL;
    v_reliability DECIMAL;
BEGIN
    -- Calculate metrics from vendor_order_acceptances and orders
    SELECT 
        COUNT(*) FILTER (WHERE voa.status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
        COUNT(*) FILTER (WHERE voa.status = 'accepted' OR voa.status = 'completed'),
        COUNT(*) FILTER (WHERE voa.status = 'rejected'),
        COUNT(*) FILTER (WHERE voa.status = 'completed'),
        COUNT(*) FILTER (WHERE voa.status = 'cancelled')
    INTO v_total_assigned, v_accepted, v_rejected, v_completed, v_cancelled
    FROM vendor_order_acceptances voa
    WHERE voa.vendor_id = p_vendor_id;
    
    -- Calculate rates
    v_acceptance_rate := CASE WHEN v_total_assigned > 0 
        THEN (v_accepted::DECIMAL / v_total_assigned * 100) 
        ELSE 0 END;
    
    v_completion_rate := CASE WHEN v_accepted > 0 
        THEN (v_completed::DECIMAL / v_accepted * 100) 
        ELSE 0 END;
    
    v_cancellation_rate := CASE WHEN v_total_assigned > 0 
        THEN (v_cancelled::DECIMAL / v_total_assigned * 100) 
        ELSE 0 END;
    
    -- Calculate average fulfillment time (hours between assignment and completion)
    SELECT AVG(EXTRACT(EPOCH FROM (o.delivered_at - voa.created_at)) / 3600)
    INTO v_avg_fulfillment
    FROM vendor_order_acceptances voa
    JOIN orders o ON voa.order_id = o.id
    WHERE voa.vendor_id = p_vendor_id 
    AND voa.status = 'completed'
    AND o.status = 'DELIVERED'
    AND o.delivered_at IS NOT NULL;
    
    v_avg_fulfillment := COALESCE(v_avg_fulfillment, 0);
    
    -- Calculate price competitiveness index
    SELECT AVG(
        CASE 
            WHEN price_deviation <= -10 THEN 100
            WHEN price_deviation <= -5 THEN 90
            WHEN price_deviation <= 0 THEN 80
            WHEN price_deviation <= 5 THEN 70
            WHEN price_deviation <= 10 THEN 60
            ELSE 50
        END
    )
    INTO v_price_index
    FROM vendor_price_comparison
    WHERE vendor_id = p_vendor_id;
    
    v_price_index := COALESCE(v_price_index, 50);
    
    -- Calculate reliability score
    v_reliability := calculate_vendor_reliability_score(
        v_acceptance_rate,
        v_completion_rate,
        v_avg_fulfillment,
        v_cancellation_rate,
        v_price_index
    );
    
    -- Insert or update performance record
    INSERT INTO vendor_performance (
        vendor_id,
        total_orders_assigned,
        orders_accepted,
        orders_rejected,
        orders_completed,
        orders_cancelled,
        acceptance_rate,
        completion_rate,
        avg_fulfillment_time,
        cancellation_rate,
        price_competitiveness_index,
        reliability_score,
        last_calculated_at,
        calculation_period
    ) VALUES (
        p_vendor_id,
        v_total_assigned,
        v_accepted,
        v_rejected,
        v_completed,
        v_cancelled,
        v_acceptance_rate,
        v_completion_rate,
        v_avg_fulfillment,
        v_cancellation_rate,
        v_price_index,
        v_reliability,
        CURRENT_TIMESTAMP,
        'all_time'
    )
    ON CONFLICT (vendor_id, calculation_period)
    DO UPDATE SET
        total_orders_assigned = EXCLUDED.total_orders_assigned,
        orders_accepted = EXCLUDED.orders_accepted,
        orders_rejected = EXCLUDED.orders_rejected,
        orders_completed = EXCLUDED.orders_completed,
        orders_cancelled = EXCLUDED.orders_cancelled,
        acceptance_rate = EXCLUDED.acceptance_rate,
        completion_rate = EXCLUDED.completion_rate,
        avg_fulfillment_time = EXCLUDED.avg_fulfillment_time,
        cancellation_rate = EXCLUDED.cancellation_rate,
        price_competitiveness_index = EXCLUDED.price_competitiveness_index,
        reliability_score = EXCLUDED.reliability_score,
        last_calculated_at = EXCLUDED.last_calculated_at,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log performance events
CREATE OR REPLACE FUNCTION log_vendor_performance_event()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO vendor_performance_events (
            vendor_id,
            order_id,
            event_type,
            event_data,
            affects_acceptance
        ) VALUES (
            NEW.vendor_id,
            NEW.order_id,
            'order_assigned',
            jsonb_build_object('routing_id', NEW.id, 'score', NEW.score),
            TRUE
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            IF NEW.status = 'accepted' THEN
                INSERT INTO vendor_performance_events (
                    vendor_id,
                    order_id,
                    event_type,
                    affects_acceptance,
                    affects_completion
                ) VALUES (
                    NEW.vendor_id,
                    NEW.order_id,
                    'order_accepted',
                    TRUE,
                    TRUE
                );
            ELSIF NEW.status = 'rejected' THEN
                INSERT INTO vendor_performance_events (
                    vendor_id,
                    order_id,
                    event_type,
                    affects_acceptance
                ) VALUES (
                    NEW.vendor_id,
                    NEW.order_id,
                    'order_rejected',
                    TRUE
                );
            ELSIF NEW.status = 'completed' THEN
                INSERT INTO vendor_performance_events (
                    vendor_id,
                    order_id,
                    event_type,
                    affects_completion,
                    affects_fulfillment_time
                ) VALUES (
                    NEW.vendor_id,
                    NEW.order_id,
                    'order_completed',
                    TRUE,
                    TRUE
                );
            ELSIF NEW.status = 'cancelled' THEN
                INSERT INTO vendor_performance_events (
                    vendor_id,
                    order_id,
                    event_type,
                    affects_cancellation
                ) VALUES (
                    NEW.vendor_id,
                    NEW.order_id,
                    'order_cancelled',
                    TRUE
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on vendor_order_acceptances table
DROP TRIGGER IF EXISTS trigger_vendor_performance_event ON vendor_order_acceptances;
CREATE TRIGGER trigger_vendor_performance_event
    AFTER INSERT OR UPDATE ON vendor_order_acceptances
    FOR EACH ROW
    EXECUTE FUNCTION log_vendor_performance_event();

-- Initialize performance records for existing vendors
INSERT INTO vendor_performance (vendor_id, calculation_period)
SELECT id, 'all_time' FROM vendors
ON CONFLICT (vendor_id, calculation_period) DO NOTHING;

-- Comments
COMMENT ON TABLE vendor_performance IS 'Tracks vendor performance metrics and reliability scores';
COMMENT ON TABLE vendor_performance_history IS 'Historical snapshots of vendor performance for trend analysis';
COMMENT ON TABLE vendor_performance_events IS 'Detailed log of events affecting vendor performance';
COMMENT ON TABLE vendor_price_comparison IS 'Tracks vendor pricing vs market average for competitiveness index';
COMMENT ON FUNCTION calculate_vendor_reliability_score IS 'Calculates vendor reliability score (0-100) based on weighted metrics';
COMMENT ON FUNCTION update_vendor_performance_metrics IS 'Recalculates all performance metrics for a vendor';
