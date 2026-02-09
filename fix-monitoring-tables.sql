-- Fix monitoring tables for existing database

-- System Alerts Table (without FK constraints)
CREATE TABLE IF NOT EXISTS system_alerts (
    id SERIAL PRIMARY KEY,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP,
    resolved_by TEXT,
    resolved_at TIMESTAMP,
    resolution TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_status ON system_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_active ON system_alerts(created_at DESC) WHERE status = 'active';

-- Notifications Table (without FK constraints)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER,
    user_id TEXT,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'webhook', 'in_app')),
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_alert ON notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Active Alerts Summary View
CREATE OR REPLACE VIEW active_alerts_summary AS
SELECT 
    severity,
    COUNT(*) as count,
    MAX(created_at) as latest_alert
FROM system_alerts
WHERE status = 'active'
GROUP BY severity;

-- Alert Response Times View
CREATE OR REPLACE VIEW alert_response_times AS
SELECT 
    id,
    severity,
    title,
    created_at,
    acknowledged_at,
    resolved_at,
    EXTRACT(EPOCH FROM (COALESCE(acknowledged_at, CURRENT_TIMESTAMP) - created_at)) as time_to_acknowledge_seconds,
    EXTRACT(EPOCH FROM (COALESCE(resolved_at, CURRENT_TIMESTAMP) - created_at)) as time_to_resolve_seconds
FROM system_alerts
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- System Health Metrics View
CREATE OR REPLACE VIEW system_health_metrics AS
SELECT 
    metric_type,
    metric_data,
    timestamp
FROM system_metrics
WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Comments
COMMENT ON TABLE system_alerts IS 'Stores system alerts and their resolution status';
COMMENT ON TABLE notifications IS 'Stores notification delivery records';
COMMENT ON VIEW active_alerts_summary IS 'Summary of active alerts by severity';
COMMENT ON VIEW alert_response_times IS 'Alert response time metrics';
COMMENT ON VIEW system_health_metrics IS 'Recent system health metrics';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Monitoring tables created successfully';
    RAISE NOTICE 'Tables: system_metrics, system_alerts, notifications';
    RAISE NOTICE 'Views: active_alerts_summary, alert_response_times, system_health_metrics';
END $$;
