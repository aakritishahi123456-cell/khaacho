-- Order Routing Configuration Table
CREATE TABLE order_routing_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Routing Score Table
CREATE TABLE vendor_routing_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID UNIQUE REFERENCES vendors(id),
    availability_score DECIMAL(5,2) DEFAULT 0,
    proximity_score DECIMAL(5,2) DEFAULT 0,
    workload_score DECIMAL(5,2) DEFAULT 0,
    price_score DECIMAL(5,2) DEFAULT 0,
    reliability_score DECIMAL(5,2) DEFAULT 0,
    overall_score DECIMAL(5,2) DEFAULT 0,
    active_orders_count INT DEFAULT 0,
    pending_orders_count INT DEFAULT 0,
    average_fulfillment_time INT DEFAULT 0, -- in hours
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Routing Log Table
CREATE TABLE order_routing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    retailer_id UUID REFERENCES retailers(id),
    routing_attempt INT DEFAULT 1,
    vendors_evaluated JSONB, -- Array of vendor evaluations
    selected_vendor_id UUID REFERENCES vendors(id),
    fallback_vendor_id UUID, -- If primary vendor rejected
    routing_reason TEXT NOT NULL,
    routing_criteria JSONB, -- Scores and weights used
    is_manual_override BOOLEAN DEFAULT false,
    override_by UUID REFERENCES users(id),
    override_reason TEXT,
    acceptance_deadline TIMESTAMP,
    accepted_at TIMESTAMP,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vendor Acceptance Tracking Table
CREATE TABLE vendor_order_acceptances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id),
    order_id UUID REFERENCES orders(id),
    routing_log_id UUID REFERENCES order_routing_logs(id),
    status VARCHAR(20) NOT NULL, -- PENDING, ACCEPTED, REJECTED, EXPIRED
    notified_at TIMESTAMP,
    response_deadline TIMESTAMP,
    responded_at TIMESTAMP,
    response_time_minutes INT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_vendor_routing_scores_vendor ON vendor_routing_scores(vendor_id);
CREATE INDEX idx_vendor_routing_scores_overall ON vendor_routing_scores(overall_score DESC);
CREATE INDEX idx_order_routing_logs_order ON order_routing_logs(order_id);
CREATE INDEX idx_order_routing_logs_vendor ON order_routing_logs(selected_vendor_id);
CREATE INDEX idx_order_routing_logs_created ON order_routing_logs(created_at DESC);
CREATE INDEX idx_vendor_acceptances_vendor ON vendor_order_acceptances(vendor_id, status);
CREATE INDEX idx_vendor_acceptances_order ON vendor_order_acceptances(order_id);
CREATE INDEX idx_vendor_acceptances_status ON vendor_order_acceptances(status, response_deadline);

-- Insert default routing configuration
INSERT INTO order_routing_config (config_key, config_value, description) VALUES
('routing_weights', '{"availability": 30, "proximity": 20, "workload": 15, "price": 20, "reliability": 15}', 'Weights for vendor selection criteria (must total 100)'),
('acceptance_timeout', '{"hours": 2, "fallback_enabled": true}', 'Time limit for vendor to accept order before fallback'),
('proximity_calculation', '{"method": "city_based", "same_city_bonus": 20, "same_state_bonus": 10}', 'How to calculate location proximity'),
('workload_thresholds', '{"low": 5, "medium": 10, "high": 20, "max": 30}', 'Active order count thresholds for workload scoring'),
('price_tolerance', '{"max_difference_percent": 15, "prefer_lower": true}', 'Price comparison tolerance'),
('min_reliability_score', '{"score": 3.0, "allow_override": true}', 'Minimum vendor reliability score to be eligible'),
('auto_routing_enabled', '{"enabled": true, "require_admin_approval": false}', 'Enable/disable automatic routing');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_routing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_routing_config_updated_at
    BEFORE UPDATE ON order_routing_config
    FOR EACH ROW
    EXECUTE FUNCTION update_routing_updated_at();

CREATE TRIGGER trigger_vendor_routing_scores_updated_at
    BEFORE UPDATE ON vendor_routing_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_routing_updated_at();

CREATE TRIGGER trigger_vendor_acceptances_updated_at
    BEFORE UPDATE ON vendor_order_acceptances
    FOR EACH ROW
    EXECUTE FUNCTION update_routing_updated_at();

COMMENT ON TABLE order_routing_config IS 'Configuration for smart order routing engine';
COMMENT ON TABLE vendor_routing_scores IS 'Real-time vendor scores for routing decisions';
COMMENT ON TABLE order_routing_logs IS 'Audit log of all routing decisions';
COMMENT ON TABLE vendor_order_acceptances IS 'Tracking vendor acceptance/rejection of orders';
