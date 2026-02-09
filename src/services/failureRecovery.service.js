const prisma = require('../config/database');
const logger = require('../utils/logger');
const queueManager = require('../queues/queueManager');

/**
 * Failure Recovery Service
 * Handles crash recovery, retry logic, and workflow resumption
 */

// ============================================================================
// WEBHOOK EVENT STORAGE
// ============================================================================

/**
 * Store webhook event before processing
 */
async function storeWebhookEvent(source, eventType, payload, headers = {}) {
  try {
    const event = await prisma.$queryRaw`
      INSERT INTO webhook_events (source, event_type, payload, headers)
      VALUES (${source}, ${eventType}, ${JSON.stringify(payload)}::jsonb, ${JSON.stringify(headers)}::jsonb)
      RETURNING id, status, created_at
    `;

    logger.info('Webhook event stored', {
      eventId: event[0].id,
      source,
      eventType,
    });

    return event[0];
  } catch (error) {
    logger.error('Failed to store webhook event', {
      error: error.message,
      source,
      eventType,
    });
    throw error;
  }
}

/**
 * Mark webhook event as processing
 */
async function markWebhookProcessing(eventId) {
  await prisma.$queryRaw`
    UPDATE webhook_events
    SET status = 'processing',
        processing_started_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${eventId}
  `;
}

/**
 * Mark webhook event as completed
 */
async function markWebhookCompleted(eventId) {
  await prisma.$queryRaw`
    UPDATE webhook_events
    SET status = 'completed',
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${eventId}
  `;

  logger.info('Webhook event completed', { eventId });
}

/**
 * Mark webhook event as failed
 */
async function markWebhookFailed(eventId, error) {
  await prisma.$queryRaw`
    UPDATE webhook_events
    SET status = 'failed',
        retry_count = retry_count + 1,
        error_message = ${error.message},
        error_stack = ${error.stack},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${eventId}
  `;

  logger.error('Webhook event failed', {
    eventId,
    error: error.message,
  });
}

/**
 * Get pending webhook events
 */
async function getPendingWebhookEvents(limit = 100) {
  const events = await prisma.$queryRaw`
    SELECT id, source, event_type, payload, headers, retry_count
    FROM webhook_events
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  return events;
}

/**
 * Get failed webhook events that can be retried
 */
async function getRetryableWebhookEvents(limit = 50) {
  const events = await prisma.$queryRaw`
    SELECT id, source, event_type, payload, headers, retry_count
    FROM webhook_events
    WHERE status = 'failed'
    AND retry_count < max_retries
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  return events;
}

/**
 * Get stuck webhook events (processing for too long)
 */
async function getStuckWebhookEvents(timeoutMinutes = 5) {
  const events = await prisma.$queryRaw`
    SELECT id, source, event_type, payload, retry_count
    FROM webhook_events
    WHERE status = 'processing'
    AND processing_started_at < CURRENT_TIMESTAMP - INTERVAL '${timeoutMinutes} minutes'
  `;

  return events;
}

// ============================================================================
// WORKFLOW STATE MANAGEMENT
// ============================================================================

/**
 * Create workflow state
 */
async function createWorkflowState(workflowType, entityType, entityId, currentStep, stepData = {}, totalSteps = null) {
  try {
    const workflow = await prisma.$queryRaw`
      INSERT INTO workflow_states (workflow_type, entity_type, entity_id, current_step, step_data, total_steps)
      VALUES (${workflowType}, ${entityType}, ${entityId}, ${currentStep}, ${JSON.stringify(stepData)}::jsonb, ${totalSteps})
      RETURNING id, status, created_at
    `;

    logger.info('Workflow state created', {
      workflowId: workflow[0].id,
      workflowType,
      entityType,
      entityId,
      currentStep,
    });

    return workflow[0];
  } catch (error) {
    logger.error('Failed to create workflow state', {
      error: error.message,
      workflowType,
      entityType,
      entityId,
    });
    throw error;
  }
}

/**
 * Update workflow step
 */
async function updateWorkflowStep(workflowId, currentStep, stepData = {}) {
  await prisma.$queryRaw`
    UPDATE workflow_states
    SET current_step = ${currentStep},
        step_data = ${JSON.stringify(stepData)}::jsonb,
        last_heartbeat = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${workflowId}
  `;

  logger.info('Workflow step updated', { workflowId, currentStep });
}

/**
 * Update workflow heartbeat
 */
async function updateWorkflowHeartbeat(workflowId) {
  await prisma.$queryRaw`
    UPDATE workflow_states
    SET last_heartbeat = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${workflowId}
  `;
}

/**
 * Complete workflow
 */
async function completeWorkflow(workflowId) {
  await prisma.$queryRaw`
    UPDATE workflow_states
    SET status = 'completed',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${workflowId}
  `;

  logger.info('Workflow completed', { workflowId });
}

/**
 * Fail workflow
 */
async function failWorkflow(workflowId, error) {
  await prisma.$queryRaw`
    UPDATE workflow_states
    SET status = 'failed',
        error_message = ${error.message},
        retry_count = retry_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${workflowId}
  `;

  logger.error('Workflow failed', {
    workflowId,
    error: error.message,
  });
}

/**
 * Get incomplete workflows (for crash recovery)
 */
async function getIncompleteWorkflows(workflowType = null) {
  const typeFilter = workflowType ? `AND workflow_type = '${workflowType}'` : '';
  
  const workflows = await prisma.$queryRaw`
    SELECT id, workflow_type, entity_type, entity_id, current_step, step_data, retry_count
    FROM workflow_states
    WHERE status = 'in_progress'
    ${typeFilter}
    ORDER BY created_at ASC
  `;

  return workflows;
}

/**
 * Get stale workflows (no heartbeat for too long)
 */
async function getStaleWorkflows(timeoutMinutes = 5) {
  const workflows = await prisma.$queryRaw`
    SELECT id, workflow_type, entity_type, entity_id, current_step, step_data, retry_count
    FROM workflow_states
    WHERE status = 'in_progress'
    AND last_heartbeat < CURRENT_TIMESTAMP - INTERVAL '${timeoutMinutes} minutes'
  `;

  return workflows;
}

// ============================================================================
// VENDOR ASSIGNMENT RETRY
// ============================================================================

/**
 * Create vendor assignment retry record
 */
async function createVendorAssignmentRetry(orderId, vendorId, routingId = null, responseDeadlineMinutes = 120) {
  try {
    const retry = await prisma.$queryRaw`
      INSERT INTO vendor_assignment_retries (
        order_id, vendor_id, routing_id, response_deadline, next_retry_at
      )
      VALUES (
        ${orderId},
        ${vendorId},
        ${routingId},
        CURRENT_TIMESTAMP + INTERVAL '${responseDeadlineMinutes} minutes',
        CURRENT_TIMESTAMP
      )
      RETURNING id, attempt_number, response_deadline
    `;

    logger.info('Vendor assignment retry created', {
      retryId: retry[0].id,
      orderId,
      vendorId,
      attemptNumber: retry[0].attempt_number,
    });

    return retry[0];
  } catch (error) {
    logger.error('Failed to create vendor assignment retry', {
      error: error.message,
      orderId,
      vendorId,
    });
    throw error;
  }
}

/**
 * Mark vendor assignment as responded
 */
async function markVendorResponded(retryId, success = true) {
  const status = success ? 'success' : 'failed';
  
  await prisma.$queryRaw`
    UPDATE vendor_assignment_retries
    SET status = ${status},
        responded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${retryId}
  `;

  logger.info('Vendor assignment responded', { retryId, success });
}

/**
 * Mark vendor assignment as timeout
 */
async function markVendorTimeout(retryId, failureReason = 'No response within deadline') {
  await prisma.$queryRaw`
    UPDATE vendor_assignment_retries
    SET status = 'timeout',
        failure_reason = ${failureReason},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${retryId}
  `;

  logger.warn('Vendor assignment timeout', { retryId });
}

/**
 * Get pending vendor assignments for retry
 */
async function getPendingVendorAssignments() {
  const assignments = await prisma.$queryRaw`
    SELECT id, order_id, vendor_id, routing_id, attempt_number, max_attempts
    FROM vendor_assignment_retries
    WHERE status = 'pending'
    AND next_retry_at <= CURRENT_TIMESTAMP
    ORDER BY next_retry_at ASC
  `;

  return assignments;
}

/**
 * Get timed out vendor assignments
 */
async function getTimedOutVendorAssignments() {
  const assignments = await prisma.$queryRaw`
    SELECT id, order_id, vendor_id, attempt_number, max_attempts
    FROM vendor_assignment_retries
    WHERE status IN ('pending', 'in_progress')
    AND response_deadline < CURRENT_TIMESTAMP
    AND attempt_number < max_attempts
  `;

  return assignments;
}

/**
 * Schedule next vendor assignment retry
 */
async function scheduleNextVendorRetry(retryId, delayMinutes = 15) {
  await prisma.$queryRaw`
    UPDATE vendor_assignment_retries
    SET status = 'pending',
        attempt_number = attempt_number + 1,
        next_retry_at = CURRENT_TIMESTAMP + INTERVAL '${delayMinutes} minutes',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${retryId}
  `;

  logger.info('Next vendor retry scheduled', { retryId, delayMinutes });
}

// ============================================================================
// ORDER RECOVERY
// ============================================================================

/**
 * Create order recovery state
 */
async function createOrderRecoveryState(orderId, originalStatus, failurePoint, failureReason, recoveryData = {}) {
  try {
    const recovery = await prisma.$queryRaw`
      INSERT INTO order_recovery_state (
        order_id, original_status, failure_point, failure_reason, recovery_data
      )
      VALUES (
        ${orderId},
        ${originalStatus},
        ${failurePoint},
        ${failureReason},
        ${JSON.stringify(recoveryData)}::jsonb
      )
      ON CONFLICT (order_id) DO UPDATE
      SET recovery_status = 'pending',
          failure_point = ${failurePoint},
          failure_reason = ${failureReason},
          recovery_data = ${JSON.stringify(recoveryData)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      RETURNING id, recovery_status
    `;

    logger.warn('Order recovery state created', {
      recoveryId: recovery[0].id,
      orderId,
      failurePoint,
    });

    // Mark order as PENDING instead of FAILED
    await prisma.$queryRaw`
      UPDATE orders
      SET status = 'PENDING',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${orderId}
    `;

    return recovery[0];
  } catch (error) {
    logger.error('Failed to create order recovery state', {
      error: error.message,
      orderId,
    });
    throw error;
  }
}

/**
 * Mark order as recovered
 */
async function markOrderRecovered(recoveryId) {
  await prisma.$queryRaw`
    UPDATE order_recovery_state
    SET recovery_status = 'recovered',
        recovered_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${recoveryId}
  `;

  logger.info('Order recovered successfully', { recoveryId });
}

/**
 * Mark order recovery as failed
 */
async function markOrderRecoveryFailed(recoveryId, error) {
  await prisma.$queryRaw`
    UPDATE order_recovery_state
    SET recovery_status = 'failed',
        recovery_attempts = recovery_attempts + 1,
        last_recovery_attempt = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${recoveryId}
  `;

  logger.error('Order recovery failed', {
    recoveryId,
    error: error.message,
  });
}

/**
 * Get pending order recoveries
 */
async function getPendingOrderRecoveries() {
  const recoveries = await prisma.$queryRaw`
    SELECT id, order_id, original_status, failure_point, recovery_data, recovery_attempts, max_recovery_attempts
    FROM order_recovery_state
    WHERE recovery_status = 'pending'
    AND recovery_attempts < max_recovery_attempts
    ORDER BY created_at ASC
  `;

  return recoveries;
}

// ============================================================================
// IDEMPOTENCY
// ============================================================================

/**
 * Check idempotency key
 */
async function checkIdempotencyKey(key) {
  const existing = await prisma.$queryRaw`
    SELECT id, status, response_payload, created_at
    FROM idempotency_keys
    WHERE key = ${key}
    AND expires_at > CURRENT_TIMESTAMP
  `;

  return existing[0] || null;
}

/**
 * Create idempotency key
 */
async function createIdempotencyKey(key, operationType, requestPayload, entityType = null, entityId = null) {
  await prisma.$queryRaw`
    INSERT INTO idempotency_keys (key, operation_type, entity_type, entity_id, request_payload)
    VALUES (${key}, ${operationType}, ${entityType}, ${entityId}, ${JSON.stringify(requestPayload)}::jsonb)
    ON CONFLICT (key) DO NOTHING
  `;
}

/**
 * Complete idempotency key
 */
async function completeIdempotencyKey(key, responsePayload) {
  await prisma.$queryRaw`
    UPDATE idempotency_keys
    SET status = 'completed',
        response_payload = ${JSON.stringify(responsePayload)}::jsonb
    WHERE key = ${key}
  `;
}

// ============================================================================
// RECOVERY DASHBOARD
// ============================================================================

/**
 * Get recovery dashboard stats
 */
async function getRecoveryDashboard() {
  const stats = await prisma.$queryRaw`
    SELECT * FROM recovery_dashboard
  `;

  return stats;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Run cleanup of old recovery records
 */
async function runCleanup() {
  try {
    await prisma.$queryRaw`SELECT cleanup_recovery_tables()`;
    logger.info('Recovery tables cleanup completed');
  } catch (error) {
    logger.error('Recovery tables cleanup failed', {
      error: error.message,
    });
  }
}

module.exports = {
  // Webhook events
  storeWebhookEvent,
  markWebhookProcessing,
  markWebhookCompleted,
  markWebhookFailed,
  getPendingWebhookEvents,
  getRetryableWebhookEvents,
  getStuckWebhookEvents,
  
  // Workflow states
  createWorkflowState,
  updateWorkflowStep,
  updateWorkflowHeartbeat,
  completeWorkflow,
  failWorkflow,
  getIncompleteWorkflows,
  getStaleWorkflows,
  
  // Vendor assignment retry
  createVendorAssignmentRetry,
  markVendorResponded,
  markVendorTimeout,
  getPendingVendorAssignments,
  getTimedOutVendorAssignments,
  scheduleNextVendorRetry,
  
  // Order recovery
  createOrderRecoveryState,
  markOrderRecovered,
  markOrderRecoveryFailed,
  getPendingOrderRecoveries,
  
  // Idempotency
  checkIdempotencyKey,
  createIdempotencyKey,
  completeIdempotencyKey,
  
  // Monitoring
  getRecoveryDashboard,
  runCleanup,
};
