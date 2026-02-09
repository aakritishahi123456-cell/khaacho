-- Migration: Monitoring and Alerting System
-- Description: Tables for system metrics, alerts, and notifications

-- ============================================================================
-- SYSTEM METRICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    metric_data JSONB NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_metrics_type_timestamp ON system_metrics(metric_type, timestamp DESC);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

COMMENT ON TABLE system_metrics IS 'Stores system metrics snapshots';
COMMENT ON COLUMN system_metrics.metric_type IS 'Type of metric: snapshot, orders, jobs, api, database, system';

-- ============================================================================
-- SYSTEM ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_alerts (
    id SERIAL PRIMARY KEY,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    details JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_alerts_status ON system_alerts(status, created_at DESC);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity, created_at DESC);
CREATE INDEX idx_system_alerts_active ON system_alerts(created_at DESC) WHERE status = 'active';

COMMENT ON TABLE system_alerts IS 'Stores system alerts and their resolution status';
COMMENT ON COLUMN system_alerts.severity IS 'critical, high, medium, low';
COMMENT ON COLUMN system_alerts.status IS 'active, acknowledged, resolved';

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON COLUMN notifications.type IS 'system_alert, order_update, payment_reminder, etc.';

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- Recent metrics view
CREATE OR REPLACE VIEW recent_metrics AS
SELECT
    metric_type,
    metric_data,
    timestamp
FROM system_metrics
WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Active alerts summary
CREATE OR REPLACE VIEW active_alerts_summary AS
SELECT
    severity,
    COUNT(*) as count,
    MAX(created_at) as latest_alert
FROM system_alerts
WHERE status = 'active'
GROUP BY severity
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- Alert response times
CREATE OR REPLACE VIEW alert_response_times AS
SELECT
    id,
    severity,
    title,
    created_at,
    acknowledged_at,
    resolved_at,
    EXTRACT(EPOCH FROM (acknowledged_at - created_at)) as time_to_acknowledge_seconds,
    EXTRACT(EPOCH FROM (resolved_at - created_at)) as time_to_resolve_seconds
FROM system_alerts
WHERE acknowledged_at IS NOT NULL OR resolved_at IS NOT NULL
ORDER BY created_at DESC;

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_monitoring_tables()
RETURNS void AS $$
BEGIN
    -- Delete old metrics (older than 30 days)
    DELETE FROM system_metrics
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Delete resolved alerts (older than 90 days)
    DELETE FROM system_alerts
    WHERE status = 'resolved'
    AND resolved_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    -- Delete read notifications (older than 30 days)
    DELETE FROM notifications
    WHERE is_read = TRUE
    AND read_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    RAISE NOTICE 'Monitoring tables cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_monitoring_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_alerts_updated_at
    BEFORE UPDATE ON system_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_monitoring_timestamp();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert initial system health check
INSERT INTO system_metrics (metric_type, metric_data)
VALUES ('system_startup', '{"status": "initialized", "timestamp": "' || CURRENT_TIMESTAMP || '"}'::jsonb);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON VIEW recent_metrics IS 'Shows metrics from the last hour';
COMMENT ON VIEW active_alerts_summary IS 'Summary of active alerts by severity';
COMMENT ON VIEW alert_response_times IS 'Shows how quickly alerts are acknowledged and resolved';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Monitoring and alerting system migration completed successfully';
    RAISE NOTICE 'Created 3 tables: system_metrics, system_alerts, notifications';
    RAISE NOTICE 'Created 3 views for monitoring dashboard';
    RAISE NOTICE 'Created cleanup_monitoring_tables() function';
END $$;
