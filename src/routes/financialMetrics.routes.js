const express = require('express');
const FinancialMetricsController = require('../controllers/financialMetrics.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get metrics for specific retailer
router.get(
  '/retailer/:id',
  authenticate,
  FinancialMetricsController.getRetailerMetrics.bind(FinancialMetricsController)
);

// Recalculate metrics for specific retailer
router.post(
  '/retailer/:id/recalculate',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.recalculateMetrics.bind(FinancialMetricsController)
);

// Verify metrics accuracy
router.get(
  '/retailer/:id/verify',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.verifyAccuracy.bind(FinancialMetricsController)
);

// Get retailers with high credit utilization
router.get(
  '/high-credit-utilization',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.getHighCreditUtilization.bind(FinancialMetricsController)
);

// Get retailers with poor payment behavior
router.get(
  '/poor-payment-behavior',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.getPoorPaymentBehavior.bind(FinancialMetricsController)
);

// Get top retailers by order frequency
router.get(
  '/top-by-frequency',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.getTopByFrequency.bind(FinancialMetricsController)
);

// Get at-risk retailers
router.get(
  '/risk-retailers',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.getRiskRetailers.bind(FinancialMetricsController)
);

// Get metrics summary
router.get(
  '/summary',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.getMetricsSummary.bind(FinancialMetricsController)
);

// Recalculate all metrics (admin only)
router.post(
  '/recalculate-all',
  authenticate,
  authorize('ADMIN'),
  FinancialMetricsController.recalculateAll.bind(FinancialMetricsController)
);

// Export metrics
router.get(
  '/export',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  FinancialMetricsController.exportMetrics.bind(FinancialMetricsController)
);

module.exports = router;
