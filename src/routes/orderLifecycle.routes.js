const express = require('express');
const OrderLifecycleController = require('../controllers/orderLifecycle.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Admin/Operator actions
router.post(
  '/:id/confirm',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  OrderLifecycleController.confirmValidation,
  validate,
  OrderLifecycleController.confirmOrder.bind(OrderLifecycleController)
);

router.post(
  '/:id/assign-vendor',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  OrderLifecycleController.assignVendorValidation,
  validate,
  OrderLifecycleController.assignVendor.bind(OrderLifecycleController)
);

// Vendor actions
router.post(
  '/:id/accept',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  OrderLifecycleController.confirmValidation,
  validate,
  OrderLifecycleController.acceptOrder.bind(OrderLifecycleController)
);

router.post(
  '/:id/dispatch',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  OrderLifecycleController.dispatchValidation,
  validate,
  OrderLifecycleController.dispatchOrder.bind(OrderLifecycleController)
);

router.post(
  '/:id/deliver',
  authenticate,
  authorize('VENDOR', 'ADMIN'),
  OrderLifecycleController.confirmValidation,
  validate,
  OrderLifecycleController.deliverOrder.bind(OrderLifecycleController)
);

// Admin/Operator complete order
router.post(
  '/:id/complete',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  OrderLifecycleController.confirmValidation,
  validate,
  OrderLifecycleController.completeOrder.bind(OrderLifecycleController)
);

// Cancel order (any authorized user)
router.post(
  '/:id/cancel',
  authenticate,
  authorize('ADMIN', 'OPERATOR', 'VENDOR'),
  OrderLifecycleController.cancelValidation,
  validate,
  OrderLifecycleController.cancelOrder.bind(OrderLifecycleController)
);

// Get order status history
router.get(
  '/:id/history',
  authenticate,
  OrderLifecycleController.getOrderStatusHistory.bind(OrderLifecycleController)
);

module.exports = router;
