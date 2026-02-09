const orderRoutingService = require('../services/orderRouting.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Route order to vendor (automatic or manual)
 */
exports.routeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { vendorId, overrideReason } = req.body;

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return errorResponse(res, 'Order not found', 404);
    }

    const orderData = {
      retailerId: order.retailerId,
      items: order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    const options = vendorId ? {
      manualVendorId: vendorId,
      overrideBy: req.user.id,
      overrideReason,
    } : {};

    const result = await orderRoutingService.routeOrder(orderId, orderData, options);

    return successResponse(res, result, 'Order routed successfully');
  } catch (error) {
    logger.error('Route order error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get routing logs for an order
 */
exports.getRoutingLogs = async (req, res) => {
  try {
    const { orderId } = req.params;

    const logs = await orderRoutingService.getOrderRoutingLogs(orderId);

    return successResponse(res, logs, 'Routing logs retrieved');
  } catch (error) {
    logger.error('Get routing logs error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get vendor acceptance status
 */
exports.getAcceptanceStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const status = await orderRoutingService.getVendorAcceptanceStatus(orderId);

    return successResponse(res, status, 'Acceptance status retrieved');
  } catch (error) {
    logger.error('Get acceptance status error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Vendor accepts or rejects order
 */
exports.respondToOrder = async (req, res) => {
  try {
    const { acceptanceId } = req.params;
    const { response, reason } = req.body;

    if (!['ACCEPTED', 'REJECTED'].includes(response)) {
      return errorResponse(res, 'Invalid response. Must be ACCEPTED or REJECTED', 400);
    }

    const result = await orderRoutingService.handleVendorResponse(
      acceptanceId,
      response === 'ACCEPTED' ? 'ACCEPTED' : { reason },
      req.user.id
    );

    return successResponse(res, result, `Order ${response.toLowerCase()}`);
  } catch (error) {
    logger.error('Respond to order error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get routing configuration
 */
exports.getRoutingConfig = async (req, res) => {
  try {
    const config = await orderRoutingService.getRoutingConfig();

    return successResponse(res, config, 'Routing configuration retrieved');
  } catch (error) {
    logger.error('Get routing config error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update routing configuration
 */
exports.updateRoutingConfig = async (req, res) => {
  try {
    const { configKey } = req.params;
    const { configValue } = req.body;

    const config = await prisma.orderRoutingConfig.update({
      where: { configKey },
      data: {
        configValue,
        updatedBy: req.user.id,
      },
    });

    return successResponse(res, config, 'Routing configuration updated');
  } catch (error) {
    logger.error('Update routing config error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get vendor routing scores
 */
exports.getVendorScores = async (req, res) => {
  try {
    const scores = await prisma.vendorRoutingScore.findMany({
      orderBy: { overallScore: 'desc' },
      include: {
        vendor: {
          include: {
            user: {
              select: {
                businessName: true,
                city: true,
                state: true,
              },
            },
          },
        },
      },
    });

    return successResponse(res, scores, 'Vendor scores retrieved');
  } catch (error) {
    logger.error('Get vendor scores error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Manually trigger fallback routing
 */
exports.triggerFallback = async (req, res) => {
  try {
    const { orderId } = req.params;

    const result = await orderRoutingService.handleFallbackRouting(orderId);

    return successResponse(res, result, 'Fallback routing triggered');
  } catch (error) {
    logger.error('Trigger fallback error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};
