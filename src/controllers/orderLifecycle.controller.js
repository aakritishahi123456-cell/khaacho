const { body, param } = require('express-validator');
const OrderLifecycleService = require('../services/orderLifecycle.service');
const ApiResponse = require('../utils/response');

class OrderLifecycleController {
  static confirmValidation = [
    param('id').isUUID().withMessage('Invalid order ID'),
  ];

  static assignVendorValidation = [
    param('id').isUUID().withMessage('Invalid order ID'),
    body('vendorId').isUUID().withMessage('Invalid vendor ID'),
  ];

  static dispatchValidation = [
    param('id').isUUID().withMessage('Invalid order ID'),
    body('expectedDelivery').optional().isISO8601().withMessage('Invalid date format'),
  ];

  static cancelValidation = [
    param('id').isUUID().withMessage('Invalid order ID'),
    body('reason').notEmpty().withMessage('Cancellation reason is required'),
  ];

  async confirmOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderLifecycleService.confirmOrder(id, req.user.id);
      return ApiResponse.success(res, order, 'Order confirmed successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignVendor(req, res, next) {
    try {
      const { id } = req.params;
      const { vendorId } = req.body;
      const order = await OrderLifecycleService.assignVendor(id, vendorId, req.user.id);
      return ApiResponse.success(res, order, 'Vendor assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async acceptOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderLifecycleService.acceptOrder(id, req.user.id);
      return ApiResponse.success(res, order, 'Order accepted successfully');
    } catch (error) {
      next(error);
    }
  }

  async dispatchOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { expectedDelivery } = req.body;
      const order = await OrderLifecycleService.dispatchOrder(id, req.user.id, expectedDelivery);
      return ApiResponse.success(res, order, 'Order dispatched successfully');
    } catch (error) {
      next(error);
    }
  }

  async deliverOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderLifecycleService.deliverOrder(id, req.user.id);
      return ApiResponse.success(res, order, 'Order delivered successfully');
    } catch (error) {
      next(error);
    }
  }

  async completeOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await OrderLifecycleService.completeOrder(id, req.user.id);
      return ApiResponse.success(res, order, 'Order completed successfully');
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await OrderLifecycleService.cancelOrder(id, req.user.id, reason);
      return ApiResponse.success(res, order, 'Order cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  async getOrderStatusHistory(req, res, next) {
    try {
      const { id } = req.params;
      const history = await OrderLifecycleService.getOrderStatusHistory(id);
      return ApiResponse.success(res, history, 'Order status history retrieved');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderLifecycleController();
