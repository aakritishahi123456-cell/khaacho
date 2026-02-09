-- Migration: Price Intelligence Module
-- Description: Track historical prices, detect anomalies, and provide market insights

-- Product Price History Table
CREATE TABLE IF NOT EXISTS product_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Price data
    price DECIMAL(12,2) NOT NULL,
    previous_price DECIMAL(12,2),
    price_change DECIMAL(12,2), -- Absolute change
    price_change_percent DECIMAL(8,2), -- Percentage change
    
    -- Market context
    market_avg_price DECIMAL(12,2),
    deviation_from_market DECIMAL(8,2), -- Percentage deviation
    is_lowest_price BOOLEAN DEFAULT FALSE,
    is_highest_price BOOLEAN DEFAULT FALSE,
    
    -- Change reason
    change_reason VARCHAR(100), -- manual_update, market_adjustment, cost_increase, promotion, etc.
    notes TEXT,
    
    -- Metadata
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP,
    is_current BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT check_price_positive CHECK (price > 0)
);

-- Market Price Analytics Table
CREATE TABLE IF NOT EXISTS market_price_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Current market state
    current_avg_price DECIMAL(12,2) NOT NULL,
    current_min_price DECIMAL(12,2) NOT NULL,
    current_max_price DECIMAL(12,2) NOT NULL,
    current_median_price DECIMAL(12,2),
    
    -- Price range
    price_range DECIMAL(12,2), -- max - min
    price_range_percent DECIMAL(8,2), -- (range / avg) * 100
    
    -- Vendor counts
    total_vendors INTEGER DEFAULT 0,
    vendors_below_avg INTEGER DEFAULT 0,
    vendors_above_avg INTEGER DEFAULT 0,
    
    -- Historical comparison (30 days)
    avg_price_30d_ago DECIMAL(12,2),
    price_change_30d DECIMAL(12,2),
    price_change_30d_percent DECIMAL(8,2),
    
    -- Volatility metrics
    price_volatility_score DECIMAL(5,2) DEFAULT 0, -- 0-100 scale
    price_stability_rating VARCHAR(20) DEFAULT 'STABLE', -- STABLE, MODERATE, VOLATILE, HIGHLY_VOLATILE
    
    -- Trend analysis
    price_trend VARCHAR(20) DEFAULT 'STABLE', -- INCREASING, DECREASING, STABLE, FLUCTUATING
    trend_strength DECIMAL(5,2) DEFAULT 0, -- 0-100 scale
    
    -- Best value vendor
    lowest_price_vendor_id UUID REFERENCES vendors(id),
    lowest_price DECIMAL(12,2),
    
    -- Timestamps
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(product_id)
);

-- Price Alerts Table
CREATE TABLE IF NOT EXISTS price_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL, -- abnormal_increase, abnormal_decrease, high_volatility, market_shift
    severity VARCHAR(20) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Alert details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Price data
    old_price DECIMAL(12,2),
    new_price DECIMAL(12,2),
    price_change_percent DECIMAL(8,2),
    market_avg_price DECIMAL(12,2),
    
    -- Alert metadata
    threshold_exceeded DECIMAL(8,2), -- What threshold was crossed
    alert_data JSONB, -- Additional context
    
    -- Status
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    acknowledgement_notes TEXT,
    
    -- Action taken
    action_taken VARCHAR(100),
    action_taken_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Price Recommendations Table
CREATE TABLE IF NOT EXISTS price_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Recommendation type
    recommendation_type VARCHAR(50) NOT NULL, -- price_increase, price_decrease, maintain_price
    
    -- Current state
    current_price DECIMAL(12,2) NOT NULL,
    market_avg_price DECIMAL(12,2) NOT NULL,
    
    -- Recommendation
    recommended_price DECIMAL(12,2) NOT NULL,
    expected_impact VARCHAR(20), -- POSITIVE, NEGATIVE, NEUTRAL
    
    -- Reasoning
    reason TEXT NOT NULL,
    confidence_score DECIMAL(5,2) DEFAULT 0, -- 0-100
    
    -- Supporting data
    competitor_prices JSONB,
    market_trends JSONB,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED, EXPIRED
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Price Volatility Log
CREATE TABLE IF NOT EXISTS price_volatility_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Volatility metrics
    volatility_score DECIMAL(5,2) NOT NULL,
    volatility_rating VARCHAR(20) NOT NULL,
    
    -- Price statistics
    min_price DECIMAL(12,2) NOT NULL,
    max_price DECIMAL(12,2) NOT NULL,
    avg_price DECIMAL(12,2) NOT NULL,
    std_deviation DECIMAL(12,2),
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_type VARCHAR(20) DEFAULT 'DAILY', -- DAILY, WEEKLY, MONTHLY
    
    -- Change frequency
    price_changes_count INTEGER DEFAULT 0,
    vendors_changed_price INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_price_history_product ON product_price_history(product_id);
CREATE INDEX idx_price_history_vendor ON product_price_history(vendor_id);
CREATE INDEX idx_price_history_current ON product_price_history(is_current) WHERE is_current = TRUE;
CREATE INDEX idx_price_history_effective ON product_price_history(effective_from, effective_to);
CREATE INDEX idx_price_history_created ON product_price_history(created_at DESC);

CREATE INDEX idx_market_analytics_product ON market_price_analytics(product_id);
CREATE INDEX idx_market_analytics_volatility ON market_price_analytics(price_volatility_score DESC);
CREATE INDEX idx_market_analytics_trend ON market_price_analytics(price_trend);
CREATE INDEX idx_market_analytics_lowest_vendor ON market_price_analytics(lowest_price_vendor_id);

CREATE INDEX idx_price_alerts_product ON price_alerts(product_id);
CREATE INDEX idx_price_alerts_vendor ON price_alerts(vendor_id);
CREATE INDEX idx_price_alerts_type ON price_alerts(alert_type, severity);
CREATE INDEX idx_price_alerts_acknowledged ON price_alerts(is_acknowledged, created_at DESC);
CREATE INDEX idx_price_alerts_created ON price_alerts(created_at DESC);

CREATE INDEX idx_price_recommendations_product ON price_recommendations(product_id);
CREATE INDEX idx_price_recommendations_vendor ON price_recommendations(vendor_id);
CREATE INDEX idx_price_recommendations_status ON price_recommendations(status);
CREATE INDEX idx_price_recommendations_created ON price_recommendations(created_at DESC);

CREATE INDEX idx_volatility_log_product ON price_volatility_log(product_id);
CREATE INDEX idx_volatility_log_period ON price_volatility_log(period_start, period_end);
CREATE INDEX idx_volatility_log_score ON price_volatility_log(volatility_score DESC);

-- Function to calculate price volatility score
CREATE OR REPLACE FUNCTION calculate_price_volatility(
    p_product_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS DECIMAL AS $$
DECLARE
    v_price_changes INTEGER;
    v_avg_change_percent DECIMAL;
    v_max_change_percent DECIMAL;
    v_std_deviation DECIMAL;
    v_volatility_score DECIMAL;
BEGIN
    -- Count price changes in period
    SELECT COUNT(*)
    INTO v_price_changes
    FROM product_price_history
    WHERE product_id = p_product_id
    AND created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL;
    
    -- Calculate average and max percentage changes
    SELECT 
        AVG(ABS(price_change_percent)),
        MAX(ABS(price_change_percent)),
        STDDEV(price_change_percent)
    INTO v_avg_change_percent, v_max_change_percent, v_std_deviation
    FROM product_price_history
    WHERE product_id = p_product_id
    AND created_at >= CURRENT_TIMESTAMP - (p_days || ' days')::INTERVAL
    AND price_change_percent IS NOT NULL;
    
    -- Calculate volatility score (0-100)
    v_volatility_score := LEAST(100, (
        (v_price_changes * 2) + -- Frequency factor
        (COALESCE(v_avg_change_percent, 0) * 3) + -- Average change factor
        (COALESCE(v_max_change_percent, 0) * 2) + -- Max change factor
        (COALESCE(v_std_deviation, 0) * 2) -- Deviation factor
    ));
    
    RETURN COALESCE(v_volatility_score, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update market price analytics
CREATE OR REPLACE FUNCTION update_market_price_analytics(p_product_id UUID)
RETURNS void AS $$
DECLARE
    v_current_avg DECIMAL;
    v_current_min DECIMAL;
    v_current_max DECIMAL;
    v_current_median DECIMAL;
    v_total_vendors INTEGER;
    v_vendors_below INTEGER;
    v_vendors_above INTEGER;
    v_avg_30d_ago DECIMAL;
    v_volatility DECIMAL;
    v_volatility_rating VARCHAR(20);
    v_trend VARCHAR(20);
    v_trend_strength DECIMAL;
    v_lowest_vendor UUID;
    v_lowest_price DECIMAL;
BEGIN
    -- Get current market statistics from vendor_products
    SELECT 
        AVG(vendor_price),
        MIN(vendor_price),
        MAX(vendor_price),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vendor_price),
        COUNT(DISTINCT vendor_id)
    INTO v_current_avg, v_current_min, v_current_max, v_current_median, v_total_vendors
    FROM vendor_products
    WHERE product_id = p_product_id
    AND is_available = TRUE
    AND deleted_at IS NULL;
    
    -- Count vendors below and above average
    SELECT 
        COUNT(*) FILTER (WHERE vendor_price < v_current_avg),
        COUNT(*) FILTER (WHERE vendor_price > v_current_avg)
    INTO v_vendors_below, v_vendors_above
    FROM vendor_products
    WHERE product_id = p_product_id
    AND is_available = TRUE
    AND deleted_at IS NULL;
    
    -- Get average price from 30 days ago
    SELECT AVG(price)
    INTO v_avg_30d_ago
    FROM product_price_history
    WHERE product_id = p_product_id
    AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
    AND created_at <= CURRENT_TIMESTAMP - INTERVAL '29 days';
    
    -- Calculate volatility
    v_volatility := calculate_price_volatility(p_product_id, 30);
    
    -- Determine volatility rating
    IF v_volatility >= 75 THEN
        v_volatility_rating := 'HIGHLY_VOLATILE';
    ELSIF v_volatility >= 50 THEN
        v_volatility_rating := 'VOLATILE';
    ELSIF v_volatility >= 25 THEN
        v_volatility_rating := 'MODERATE';
    ELSE
        v_volatility_rating := 'STABLE';
    END IF;
    
    -- Determine price trend
    IF v_avg_30d_ago IS NOT NULL AND v_current_avg IS NOT NULL THEN
        DECLARE
            v_change_percent DECIMAL;
        BEGIN
            v_change_percent := ((v_current_avg - v_avg_30d_ago) / v_avg_30d_ago) * 100;
            
            IF ABS(v_change_percent) < 2 THEN
                v_trend := 'STABLE';
                v_trend_strength := 0;
            ELSIF v_change_percent > 0 THEN
                v_trend := 'INCREASING';
                v_trend_strength := LEAST(100, ABS(v_change_percent) * 10);
            ELSE
                v_trend := 'DECREASING';
                v_trend_strength := LEAST(100, ABS(v_change_percent) * 10);
            END IF;
        END;
    ELSE
        v_trend := 'STABLE';
        v_trend_strength := 0;
    END IF;
    
    -- Find lowest price vendor
    SELECT vendor_id, vendor_price
    INTO v_lowest_vendor, v_lowest_price
    FROM vendor_products
    WHERE product_id = p_product_id
    AND is_available = TRUE
    AND deleted_at IS NULL
    ORDER BY vendor_price ASC
    LIMIT 1;
    
    -- Upsert market analytics
    INSERT INTO market_price_analytics (
        product_id,
        current_avg_price,
        current_min_price,
        current_max_price,
        current_median_price,
        price_range,
        price_range_percent,
        total_vendors,
        vendors_below_avg,
        vendors_above_avg,
        avg_price_30d_ago,
        price_change_30d,
        price_change_30d_percent,
        price_volatility_score,
        price_stability_rating,
        price_trend,
        trend_strength,
        lowest_price_vendor_id,
        lowest_price,
        last_calculated_at
    ) VALUES (
        p_product_id,
        v_current_avg,
        v_current_min,
        v_current_max,
        v_current_median,
        v_current_max - v_current_min,
        CASE WHEN v_current_avg > 0 THEN ((v_current_max - v_current_min) / v_current_avg) * 100 ELSE 0 END,
        v_total_vendors,
        v_vendors_below,
        v_vendors_above,
        v_avg_30d_ago,
        CASE WHEN v_avg_30d_ago IS NOT NULL THEN v_current_avg - v_avg_30d_ago ELSE NULL END,
        CASE WHEN v_avg_30d_ago IS NOT NULL AND v_avg_30d_ago > 0 
             THEN ((v_current_avg - v_avg_30d_ago) / v_avg_30d_ago) * 100 
             ELSE NULL END,
        v_volatility,
        v_volatility_rating,
        v_trend,
        v_trend_strength,
        v_lowest_vendor,
        v_lowest_price,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (product_id)
    DO UPDATE SET
        current_avg_price = EXCLUDED.current_avg_price,
        current_min_price = EXCLUDED.current_min_price,
        current_max_price = EXCLUDED.current_max_price,
        current_median_price = EXCLUDED.current_median_price,
        price_range = EXCLUDED.price_range,
        price_range_percent = EXCLUDED.price_range_percent,
        total_vendors = EXCLUDED.total_vendors,
        vendors_below_avg = EXCLUDED.vendors_below_avg,
        vendors_above_avg = EXCLUDED.vendors_above_avg,
        avg_price_30d_ago = EXCLUDED.avg_price_30d_ago,
        price_change_30d = EXCLUDED.price_change_30d,
        price_change_30d_percent = EXCLUDED.price_change_30d_percent,
        price_volatility_score = EXCLUDED.price_volatility_score,
        price_stability_rating = EXCLUDED.price_stability_rating,
        price_trend = EXCLUDED.price_trend,
        trend_strength = EXCLUDED.trend_strength,
        lowest_price_vendor_id = EXCLUDED.lowest_price_vendor_id,
        lowest_price = EXCLUDED.lowest_price,
        last_calculated_at = EXCLUDED.last_calculated_at,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to detect abnormal price changes
CREATE OR REPLACE FUNCTION detect_abnormal_price_change(
    p_product_id UUID,
    p_vendor_id UUID,
    p_new_price DECIMAL,
    p_old_price DECIMAL
) RETURNS void AS $$
DECLARE
    v_change_percent DECIMAL;
    v_market_avg DECIMAL;
    v_alert_severity VARCHAR(20);
    v_alert_type VARCHAR(50);
    v_threshold DECIMAL := 20; -- 20% threshold for abnormal change
BEGIN
    -- Calculate percentage change
    IF p_old_price > 0 THEN
        v_change_percent := ((p_new_price - p_old_price) / p_old_price) * 100;
    ELSE
        RETURN; -- Skip if no previous price
    END IF;
    
    -- Get market average
    SELECT current_avg_price
    INTO v_market_avg
    FROM market_price_analytics
    WHERE product_id = p_product_id;
    
    -- Determine if change is abnormal
    IF ABS(v_change_percent) >= v_threshold THEN
        -- Determine severity
        IF ABS(v_change_percent) >= 50 THEN
            v_alert_severity := 'CRITICAL';
        ELSIF ABS(v_change_percent) >= 35 THEN
            v_alert_severity := 'HIGH';
        ELSIF ABS(v_change_percent) >= 20 THEN
            v_alert_severity := 'MEDIUM';
        ELSE
            v_alert_severity := 'LOW';
        END IF;
        
        -- Determine alert type
        IF v_change_percent > 0 THEN
            v_alert_type := 'abnormal_increase';
        ELSE
            v_alert_type := 'abnormal_decrease';
        END IF;
        
        -- Create alert
        INSERT INTO price_alerts (
            alert_type,
            severity,
            product_id,
            vendor_id,
            title,
            description,
            old_price,
            new_price,
            price_change_percent,
            market_avg_price,
            threshold_exceeded,
            expires_at
        ) VALUES (
            v_alert_type,
            v_alert_severity,
            p_product_id,
            p_vendor_id,
            'Abnormal Price ' || CASE WHEN v_change_percent > 0 THEN 'Increase' ELSE 'Decrease' END,
            'Price changed by ' || ROUND(ABS(v_change_percent), 2) || '% from ' || 
            p_old_price || ' to ' || p_new_price,
            p_old_price,
            p_new_price,
            v_change_percent,
            v_market_avg,
            ABS(v_change_percent),
            CURRENT_TIMESTAMP + INTERVAL '7 days'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track price changes
CREATE OR REPLACE FUNCTION track_price_change()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_price DECIMAL;
    v_market_avg DECIMAL;
BEGIN
    -- Get previous price
    SELECT price
    INTO v_previous_price
    FROM product_price_history
    WHERE product_id = NEW.product_id
    AND vendor_id = NEW.vendor_id
    AND is_current = TRUE
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Mark previous record as not current
    IF v_previous_price IS NOT NULL THEN
        UPDATE product_price_history
        SET is_current = FALSE,
            effective_to = CURRENT_TIMESTAMP
        WHERE product_id = NEW.product_id
        AND vendor_id = NEW.vendor_id
        AND is_current = TRUE;
    END IF;
    
    -- Get market average
    SELECT AVG(vendor_price)
    INTO v_market_avg
    FROM vendor_products
    WHERE product_id = NEW.product_id
    AND is_available = TRUE;
    
    -- Insert new price history record
    INSERT INTO product_price_history (
        product_id,
        vendor_id,
        price,
        previous_price,
        price_change,
        price_change_percent,
        market_avg_price,
        deviation_from_market,
        change_reason,
        is_current
    ) VALUES (
        NEW.product_id,
        NEW.vendor_id,
        NEW.vendor_price,
        v_previous_price,
        CASE WHEN v_previous_price IS NOT NULL THEN NEW.vendor_price - v_previous_price ELSE NULL END,
        CASE WHEN v_previous_price IS NOT NULL AND v_previous_price > 0 
             THEN ((NEW.vendor_price - v_previous_price) / v_previous_price) * 100 
             ELSE NULL END,
        v_market_avg,
        CASE WHEN v_market_avg IS NOT NULL AND v_market_avg > 0 
             THEN ((NEW.vendor_price - v_market_avg) / v_market_avg) * 100 
             ELSE NULL END,
        'price_update',
        TRUE
    );
    
    -- Detect abnormal changes
    IF v_previous_price IS NOT NULL AND v_previous_price != NEW.vendor_price THEN
        PERFORM detect_abnormal_price_change(
            NEW.product_id,
            NEW.vendor_id,
            NEW.vendor_price,
            v_previous_price
        );
    END IF;
    
    -- Update market analytics
    PERFORM update_market_price_analytics(NEW.product_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on vendor_products
DROP TRIGGER IF EXISTS trigger_track_price_change ON vendor_products;
CREATE TRIGGER trigger_track_price_change
    AFTER INSERT OR UPDATE OF vendor_price ON vendor_products
    FOR EACH ROW
    WHEN (NEW.vendor_price IS NOT NULL)
    EXECUTE FUNCTION track_price_change();

-- Initialize price history for existing products
INSERT INTO product_price_history (
    product_id,
    vendor_id,
    price,
    market_avg_price,
    is_current
)
SELECT 
    vp.product_id,
    vp.vendor_id,
    vp.vendor_price,
    (SELECT AVG(vendor_price) FROM vendor_products WHERE product_id = vp.product_id),
    TRUE
FROM vendor_products vp
WHERE vp.vendor_price IS NOT NULL
AND vp.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Initialize market analytics for all products
INSERT INTO market_price_analytics (product_id)
SELECT DISTINCT id FROM products
ON CONFLICT (product_id) DO NOTHING;

-- Comments
COMMENT ON TABLE product_price_history IS 'Historical tracking of product prices per vendor';
COMMENT ON TABLE market_price_analytics IS 'Market-level price analytics and trends per product';
COMMENT ON TABLE price_alerts IS 'Alerts for abnormal price changes and volatility';
COMMENT ON TABLE price_recommendations IS 'AI-generated price recommendations for vendors';
COMMENT ON TABLE price_volatility_log IS 'Historical log of price volatility metrics';
COMMENT ON FUNCTION calculate_price_volatility IS 'Calculates price volatility score (0-100) for a product';
COMMENT ON FUNCTION update_market_price_analytics IS 'Updates market analytics for a product';
COMMENT ON FUNCTION detect_abnormal_price_change IS 'Detects and creates alerts for abnormal price changes';
