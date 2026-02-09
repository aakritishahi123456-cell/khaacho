const prisma = require('../config/database');
const riskControlService = require('../services/riskControl.service');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Check if retailer is allowed to place orders
 */
exports.checkOrderEligibility = async (req, res, next) => {
  try {
    const { retailerId } = req.body;

    if (!retailerId) {
      return next();
    }

    // Get retailer risk score
    let riskScore = await riskControlService.getRetailerRiskScore(retailerId);

    // Calculate if not exists
    if (!riskScore) {
      riskScore = await riskControlService.calculateRetailerRiskScore(retailerId);
    }

    // Check if orders are blocked
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
    });

    if (!retailer.isApproved) {
      // Check if blocked due to risk
      const blockAction = await prisma.riskAction.findFirst({
        where: {
          retailerId,
          actionType: 'ORDER_BLOCKED',
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (blockAction) {
        throw new ValidationError(
          `Orders are blocked due to: ${blockAction.reason}. Please contact admin.`
        );
      }
    }

    // Check overdue threshold
    const overdueConfig = await riskControlService.getRiskConfig('credit_overdue_blocking');
    if (overdueConfig && riskScore.daysOverdue >= overdueConfig.warning_threshold_days) {
      logger.warn('Order attempt with overdue payment', {
        retailerId,
        daysOverdue: riskScore.daysOverdue,
      });

      if (riskScore.daysOverdue >= overdueConfig.block_threshold_days) {
        throw new ValidationError(
          `Orders are blocked. Payment is overdue by ${riskScore.daysOverdue} days. Please clear outstanding dues.`
        );
      }

      // Add warning to request for response
      req.riskWarning = `Warning: Payment is overdue by ${riskScore.daysOverdue} days`;
    }

    // Check credit limit
    if (Number(retailer.outstandingDebt) >= Number(retailer.creditLimit)) {
      throw new ValidationError(
        'Credit limit exceeded. Please make a payment before placing new orders.'
      );
    }

    // Attach risk score to request for logging
    req.riskScore = riskScore;

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Trigger risk control check after payment
 */
exports.checkAfterPayment = async (retailerId) => {
  try {
    const riskControlWorker = require('../workers/riskControl.worker');
    await riskControlWorker.checkAfterPayment(retailerId);
  } catch (error) {
    logger.error('Post-payment risk check failed', {
      retailerId,
      error: error.message,
    });
  }
};

/**
 * Trigger risk control check after order status change
 */
exports.checkAfterOrderUpdate = async (orderId) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { retailerId: true, status: true },
    });

    if (!order) return;

    // Trigger risk check if order is overdue or cancelled
    if (['OVERDUE', 'CANCELLED'].includes(order.status)) {
      const riskControlWorker = require('../workers/riskControl.worker');
      await riskControlWorker.runForRetailer(order.retailerId);
    }
  } catch (error) {
    logger.error('Post-order-update risk check failed', {
      orderId,
      error: error.message,
    });
  }
};
