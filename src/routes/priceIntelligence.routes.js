const express = require('express');
const priceIntelligenceController = require('../controllers/priceIntelligence.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Dashboard (admin/operator only)
router.get(
  '/dashboard',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.getDashboard
);

// Market analytics
router.get(
  '/analytics',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.getAllMarketAnalytics
);

// Price alerts
router.get(
  '/alerts',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.getPriceAlerts
);

router.post(
  '/alerts/:alertId/acknowledge',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.acknowledgePriceAlert
);

// Volatile products
router.get(
  '/volatile-products',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.getVolatileProducts
);

// Update all analytics (admin only)
router.post(
  '/update-all-analytics',
  authorize(['ADMIN']),
  priceIntelligenceController.updateAllMarketAnalytics
);

// Product-specific endpoints
router.get(
  '/products/:productId/history',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  priceIntelligenceController.getProductPriceHistory
);

router.get(
  '/products/:productId/analytics',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  priceIntelligenceController.getMarketAnalytics
);

router.get(
  '/products/:productId/lowest-price-vendor',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.getLowestPriceVendor
);

router.get(
  '/products/:productId/comparison',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.getPriceComparison
);

router.get(
  '/products/:productId/trends',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  priceIntelligenceController.getPriceTrends
);

router.get(
  '/products/:productId/volatility',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.calculatePriceVolatility
);

router.post(
  '/products/:productId/update-analytics',
  authorize(['ADMIN', 'OPERATOR']),
  priceIntelligenceController.updateMarketAnalytics
);

module.exports = router;
