const { body, param, query } = require('express-validator');
const OrderService = require('../services/order.service');
const WhatsAppService = require('../services/whatsapp.service');
const ApiResponse = require('../utils/response');

class OrderController {
  static createValidation = [
    body('vendorId').isUUID().withMessage('Invalid vendor ID'),
    body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
    body('items.*.productId').isUUID().withMessage('Invalid product ID'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  ];

  static updateStatusValidation = [
    param('id').isUUID().withMessage('Invalid order ID'),
    body('status').isIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
      .withMessage('Invalid status'),
  ];

  async createOrder(req, res, next) {
    try {
      const { vendorId, items, notes } = req.body;
      const retailerId = req.user.retailerProfile?.id;

      if (!retailerId) {
        return ApiResponse.error(res, 'Only retailers can create orders', 403);
      }

      const order = await OrderService.createOrder(retailerId, vendorId, items, notes);
      
      await WhatsAppService.sendOrderConfirmation(order);

      return ApiResponse.success(res, order, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async updateOrderStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const order = await OrderService.updateOrderStatus(id, status, req.user.id);
      
      return ApiResponse.success(res, order, 'Order status updated');
    } catch (error) {
      next(error);
    }
  }

  async getOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderService.getOrderById(id);
      
      return ApiResponse.success(res, order, 'Order retrieved');
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req, res, next) {
    try {
      const { status, paymentStatus, page = 1, limit = 20 } = req.query;
      const filters = {};

      if (req.user.role === 'RETAILER') {
        filters.retailerId = req.user.retailerProfile.id;
      } else if (req.user.role === 'VENDOR') {
        filters.vendorId = req.user.vendorProfile.id;
      }

      if (status) filters.status = status;
      if (paymentStatus) filters.paymentStatus = paymentStatus;

      const result = await OrderService.getOrders(filters, parseInt(page), parseInt(limit));
      
      return ApiResponse.paginated(res, result.orders, result.pagination, 'Orders retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();
