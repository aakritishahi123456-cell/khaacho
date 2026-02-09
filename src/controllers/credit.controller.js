const { body, param } = require('express-validator');
const CreditService = require('../services/credit.service');
const WhatsAppService = require('../services/whatsapp.service');
const OrderService = require('../services/order.service');
const ApiResponse = require('../utils/response');

class CreditController {
  static paymentValidation = [
    body('orderId').isUUID().withMessage('Invalid order ID'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
    body('referenceNumber').optional().isString(),
  ];

  async recordPayment(req, res, next) {
    try {
      const { orderId, amount, referenceNumber } = req.body;

      await CreditService.recordPayment(orderId, amount, referenceNumber);
      const order = await OrderService.getOrderById(orderId);

      await WhatsAppService.sendPaymentConfirmation(order, amount);

      return ApiResponse.success(res, order, 'Payment recorded successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCreditHistory(req, res, next) {
    try {
      const { vendorId, page = 1, limit = 50 } = req.query;
      const retailerId = req.user.retailerProfile?.id;

      if (!retailerId && req.user.role !== 'ADMIN') {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const result = await CreditService.getCreditHistory(
        retailerId,
        vendorId,
        parseInt(page),
        parseInt(limit)
      );

      return ApiResponse.paginated(res, result.entries, result.pagination, 'Credit history retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getCreditScore(req, res, next) {
    try {
      const retailerId = req.user.retailerProfile?.id || req.params.retailerId;

      if (!retailerId) {
        return ApiResponse.error(res, 'Retailer ID required', 400);
      }

      const score = await CreditService.calculateCreditScore(retailerId);

      return ApiResponse.success(res, { creditScore: score }, 'Credit score calculated');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CreditController();
