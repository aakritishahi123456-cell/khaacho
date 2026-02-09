-- Migration: Failure Recovery System
-- Description: Implement comprehensive failure recovery mechanisms

-- ============================================================================
-- WEBHOOK EVENT STORAGE (Store before processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    headers JSONB,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    processing_started_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    error_stack TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_status ON webhook_events(status, created_at);
CREATE INDEX idx_webhook_events_source_status ON webhook_events(source, status);
CREATE INDEX idx_webhook_events_pending ON webhook_events(created_at) WHERE status = 'pending';
CREATE INDEX idx_webhook_events_failed ON webhook_events(retry_count, status) WHERE status = 'failed' AND retry_count < max_retries;

-- ============================================================================
-- WORKFLOW STATE TRACKING (Resume incomplete workflows)
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_states (
    id SERIAL PRIMARY KEY,
    workflow_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    total_steps INTEGER,
    step_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_states_status ON workflow_states(status, last_heartbeat);
CREATE INDEX idx_workflow_states_entity ON workflow_states(entity_type, entity_id);
CREATE INDEX idx_workflow_states_type_status ON workflow_states(workflow_type, status);
CREATE INDEX idx_workflow_states_stale ON workflow_states(last_heartbeat) WHERE status = 'in_progress';

-- ============================================================================
-- VENDOR ASSIGNMENT RETRY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_assignment_retries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    routing_id INTEGER REFERENCES vendor_order_acceptances(id),
    vendor_id INTEGER REFERENCES vendors(id),
    attempt_number INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response_deadline TIMESTAMP NOT NULL,
    responded_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_assignment_order ON vendor_assignment_retries(order_id, attempt_number);
CREATE INDEX idx_vendor_assignment_status ON vendor_assignment_retries(status, next_retry_at);
CREATE INDEX idx_vendor_assignment_pending ON vendor_assignment_retries(next_retry_at) WHERE status = 'pending';

-- ============================================================================
-- ORDER RECOVERY STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_recovery_state (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) UNIQUE,
    original_status VARCHAR(20) NOT NULL,
    recovery_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    failure_point VARCHAR(100) NOT NULL,
    failure_reason TEXT,
    recovery_attempts INTEGER NOT NULL DEFAULT 0,
    max_recovery_attempts INTEGER NOT NULL DEFAULT 5,
    recovery_data JSONB,
    last_recovery_attempt TIMESTAMP,
    recovered_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_recovery_status ON order_recovery_state(recovery_status, last_recovery_attempt);
CREATE INDEX idx_order_recovery_pending ON order_recovery_state(created_at) WHERE recovery_status = 'pending';

-- ============================================================================
-- IDEMPOTENCY KEYS (Prevent duplicate processing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    operation_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    request_payload JSONB,
    response_payload JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys(expires_at) WHERE status = 'completed';

-- ============================================================================
-- RECOVERY MONITORING VIEW
-- ============================================================================

CREATE OR REPLACE VIEW recovery_dashboard AS
SELECT
    'webhook_events' as source,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'failed' AND retry_count < max_retries) as retry_count,
    COUNT(*) FILTER (WHERE status = 'processing' AND processing_started_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes') as stuck_count
FROM webhook_events
UNION ALL
SELECT
    'workflow_states' as source,
    COUNT(*) FILTER (WHERE status = 'in_progress') as pending_count,
    COUNT(*) FILTER (WHERE status = 'failed') as retry_count,
    COUNT(*) FILTER (WHERE status = 'in_progress' AND last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '5 minutes') as stuck_count
FROM workflow_states
UNION ALL
SELECT
    'vendor_assignments' as source,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'timeout' AND attempt_number < max_attempts) as retry_count,
    COUNT(*) FILTER (WHERE status = 'in_progress' AND response_deadline < CURRENT_TIMESTAMP) as stuck_count
FROM vendor_assignment_retries
UNION ALL
SELECT
    'order_recovery' as source,
    COUNT(*) FILTER (WHERE recovery_status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE recovery_status = 'in_progress') as retry_count,
    COUNT(*) FILTER (WHERE recovery_status = 'failed' AND recovery_attempts < max_recovery_attempts) as stuck_count
FROM order_recovery_state;

-- ============================================================================
-- CLEANUP FUNCTION FOR OLD RECORDS
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_recovery_tables()
RETURNS void AS $$
BEGIN
    -- Delete completed webhook events older than 7 days
    DELETE FROM webhook_events
    WHERE status = 'completed'
    AND processed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    -- Delete completed workflows older than 7 days
    DELETE FROM workflow_states
    WHERE status = 'completed'
    AND completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    -- Delete expired idempotency keys
    DELETE FROM idempotency_keys
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete old successful vendor assignments
    DELETE FROM vendor_assignment_retries
    WHERE status = 'success'
    AND responded_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Delete recovered orders older than 30 days
    DELETE FROM order_recovery_state
    WHERE recovery_status = 'recovered'
    AND recovered_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER TO UPDATE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_recovery_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_events_updated_at
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_recovery_timestamp();

CREATE TRIGGER workflow_states_updated_at
    BEFORE UPDATE ON workflow_states
    FOR EACH ROW
    EXECUTE FUNCTION update_recovery_timestamp();

CREATE TRIGGER vendor_assignment_retries_updated_at
    BEFORE UPDATE ON vendor_assignment_retries
    FOR EACH ROW
    EXECUTE FUNCTION update_recovery_timestamp();

CREATE TRIGGER order_recovery_state_updated_at
    BEFORE UPDATE ON order_recovery_state
    FOR EACH ROW
    EXECUTE FUNCTION update_recovery_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE webhook_events IS 'Stores all webhook events before processing for crash recovery';
COMMENT ON TABLE workflow_states IS 'Tracks workflow progress for crash recovery';
COMMENT ON TABLE vendor_assignment_retries IS 'Tracks vendor assignment attempts with retry logic';
COMMENT ON TABLE order_recovery_state IS 'Tracks orders that need recovery after failures';
COMMENT ON TABLE idempotency_keys IS 'Prevents duplicate processing of operations';

COMMENT ON COLUMN webhook_events.status IS 'pending, processing, completed, failed';
COMMENT ON COLUMN workflow_states.last_heartbeat IS 'Updated periodically to detect crashed workflows';
COMMENT ON COLUMN vendor_assignment_retries.status IS 'pending, in_progress, success, failed, timeout';
COMMENT ON COLUMN order_recovery_state.recovery_status IS 'pending, in_progress, recovered, failed';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Failure recovery system migration completed successfully';
    RAISE NOTICE 'Created 5 tables: webhook_events, workflow_states, vendor_assignment_retries, order_recovery_state, idempotency_keys';
    RAISE NOTICE 'Created recovery_dashboard view for monitoring';
    RAISE NOTICE 'Created cleanup_recovery_tables() function';
END $$;
