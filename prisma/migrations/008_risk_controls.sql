-- Risk Control Configuration Table
CREATE TABLE risk_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Alerts Table
CREATE TABLE risk_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(50) NOT NULL, -- CREDIT_LIMIT_REDUCED, ORDER_BLOCKED, HIGH_RISK_RETAILER, UNUSUAL_SPIKE
    severity VARCHAR(20) NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    retailer_id UUID REFERENCES retailers(id),
    vendor_id UUID REFERENCES vendors(id),
    order_id UUID REFERENCES orders(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Risk Actions Log Table
CREATE TABLE risk_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) NOT NULL, -- CREDIT_LIMIT_REDUCED, ORDER_BLOCKED, RETAILER_FLAGGED
    retailer_id UUID REFERENCES retailers(id),
    triggered_by VARCHAR(50) NOT NULL, -- PAYMENT_DELAY, CREDIT_OVERDUE, UNUSUAL_ACTIVITY
    previous_value JSONB,
    new_value JSONB,
    reason TEXT NOT NULL,
    is_automatic BOOLEAN DEFAULT true,
    executed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Retailer Risk Score Table
CREATE TABLE retailer_risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    retailer_id UUID UNIQUE REFERENCES retailers(id),
    risk_score DECIMAL(5,2) NOT NULL DEFAULT 0, -- 0-100 scale
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    payment_delay_score DECIMAL(5,2) DEFAULT 0,
    credit_utilization_score DECIMAL(5,2) DEFAULT 0,
    order_pattern_score DECIMAL(5,2) DEFAULT 0,
    overdue_amount DECIMAL(15,2) DEFAULT 0,
    days_overdue INT DEFAULT 0,
    consecutive_delays INT DEFAULT 0,
    unusual_activity_count INT DEFAULT 0,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_risk_alerts_retailer ON risk_alerts(retailer_id, created_at DESC);
CREATE INDEX idx_risk_alerts_type ON risk_alerts(alert_type, severity);
CREATE INDEX idx_risk_alerts_acknowledged ON risk_alerts(is_acknowledged, created_at DESC);
CREATE INDEX idx_risk_actions_retailer ON risk_actions(retailer_id, created_at DESC);
CREATE INDEX idx_risk_actions_type ON risk_actions(action_type, created_at DESC);
CREATE INDEX idx_retailer_risk_scores_level ON retailer_risk_scores(risk_level);
CREATE INDEX idx_retailer_risk_scores_score ON retailer_risk_scores(risk_score DESC);

-- Insert default risk configuration
INSERT INTO risk_config (config_key, config_value, description) VALUES
('payment_delay_threshold', '{"warning_days": 7, "critical_days": 15, "credit_reduction_percent": 25}', 'Payment delay thresholds and actions'),
('credit_overdue_blocking', '{"block_threshold_days": 30, "warning_threshold_days": 15}', 'Days overdue before blocking new orders'),
('high_risk_thresholds', '{"risk_score_threshold": 70, "consecutive_delays_threshold": 3, "overdue_amount_threshold": 50000}', 'Thresholds for high-risk retailer alerts'),
('unusual_order_detection', '{"spike_multiplier": 3, "spike_window_days": 7, "min_orders_for_baseline": 5}', 'Unusual order spike detection parameters'),
('credit_limit_rules', '{"min_credit_limit": 10000, "max_reduction_percent": 50, "auto_restore_after_days": 90}', 'Credit limit adjustment rules'),
('risk_score_weights', '{"payment_delay": 40, "credit_utilization": 30, "order_pattern": 20, "overdue_amount": 10}', 'Risk score calculation weights');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_risk_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_risk_config_updated_at
    BEFORE UPDATE ON risk_config
    FOR EACH ROW
    EXECUTE FUNCTION update_risk_config_updated_at();

CREATE TRIGGER trigger_retailer_risk_scores_updated_at
    BEFORE UPDATE ON retailer_risk_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE risk_config IS 'Configurable risk control parameters';
COMMENT ON TABLE risk_alerts IS 'Risk alerts for admin review';
COMMENT ON TABLE risk_actions IS 'Log of automated risk control actions';
COMMENT ON TABLE retailer_risk_scores IS 'Real-time risk scores for retailers';
