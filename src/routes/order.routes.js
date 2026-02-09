const express = require('express');
const OrderController = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.post('/', authenticate, authorize('RETAILER'), OrderController.createValidation, validate, OrderController.createOrder.bind(OrderController));
router.get('/', authenticate, OrderController.getOrders.bind(OrderController));
router.get('/:id', authenticate, OrderController.getOrder.bind(OrderController));
router.patch('/:id/status', authenticate, authorize('VENDOR', 'ADMIN'), OrderController.updateStatusValidation, validate, OrderController.updateOrderStatus.bind(OrderController));

module.exports = router;
