const orderRoutingService = require('../../services/orderRouting.service');
const logger = require('../../utils/logger');
const monitoringService = require('../../services/monitoring.service');

/**
 * Order Routing Processor
 * Handles order routing and retries asynchronously
 */
async function orderRoutingProcessor(job) {
  const { orderId, orderData, attempt, previousVendorId } = job.data;

  logger.info(`Processing order routing job ${job.id}`, {
    orderId,
    attempt: attempt || 1,
    previousVendorId,
  });

  try {
    let result;

    if (attempt && attempt > 1) {
      // This is a retry - use fallback routing
      logger.info(`Routing retry attempt ${attempt} for order ${orderId}`);
      result = await orderRoutingService.handleFallbackRouting(orderId, previousVendorId);
    } else {
      // Initial routing
      result = await orderRoutingService.routeOrder(orderId, orderData);
    }

    logger.info(`Order routing job ${job.id} completed`, {
      orderId,
      selectedVendor: result.selectedVendor,
      score: result.score,
    });

    // Track job completion
    try {
      await monitoringService.trackJobCompleted('order-routing', job.id, true);
    } catch (error) {
      console.error('Failed to track job completion:', error.message);
    }

    return {
      success: true,
      orderId,
      vendorId: result.selectedVendor,
      routingDecision: result,
    };
  } catch (error) {
    logger.error(`Order routing job ${job.id} failed`, {
      error: error.message,
      orderId,
      attempt,
    });

    // Track job failure
    try {
      await monitoringService.trackJobCompleted('order-routing', job.id, false, error.message);
    } catch (monitorError) {
      console.error('Failed to track job failure:', monitorError.message);
    }

    throw error; // Will trigger retry
  }
}

module.exports = orderRoutingProcessor;
