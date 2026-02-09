const express = require('express');
const AnalyticsController = require('../controllers/analytics.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.get(
  '/order-trends',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AnalyticsController.orderTrendsValidation,
  validate,
  AnalyticsController.getOrderTrends.bind(AnalyticsController)
);

router.get(
  '/product-performance',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AnalyticsController.getProductPerformance.bind(AnalyticsController)
);

router.get(
  '/retailer/:id',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AnalyticsController.getRetailerAnalytics.bind(AnalyticsController)
);

router.get(
  '/vendor/:id',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AnalyticsController.getVendorAnalytics.bind(AnalyticsController)
);

module.exports = router;
