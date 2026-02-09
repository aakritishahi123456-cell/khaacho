const express = require('express');
const vendorPerformanceController = require('../controllers/vendorPerformance.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all vendors performance (admin dashboard)
router.get(
  '/',
  authorize(['ADMIN', 'OPERATOR']),
  vendorPerformanceController.getAllVendorsPerformance
);

// Get top performing vendors
router.get(
  '/top-performers',
  authorize(['ADMIN', 'OPERATOR']),
  vendorPerformanceController.getTopPerformers
);

// Get vendors needing attention
router.get(
  '/needs-attention',
  authorize(['ADMIN', 'OPERATOR']),
  vendorPerformanceController.getVendorsNeedingAttention
);

// Compare multiple vendors
router.post(
  '/compare',
  authorize(['ADMIN', 'OPERATOR']),
  vendorPerformanceController.compareVendors
);

// Recalculate all vendors performance (admin only)
router.post(
  '/recalculate-all',
  authorize(['ADMIN']),
  vendorPerformanceController.recalculateAllVendors
);

// Get specific vendor performance
router.get(
  '/:vendorId',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  vendorPerformanceController.getVendorPerformance
);

// Get vendor performance dashboard
router.get(
  '/:vendorId/dashboard',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  vendorPerformanceController.getVendorDashboard
);

// Get vendor performance history
router.get(
  '/:vendorId/history',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  vendorPerformanceController.getVendorHistory
);

// Get vendor performance events
router.get(
  '/:vendorId/events',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  vendorPerformanceController.getVendorEvents
);

// Get vendor price competitiveness
router.get(
  '/:vendorId/pricing',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  vendorPerformanceController.getVendorPricing
);

// Recalculate specific vendor performance
router.post(
  '/:vendorId/recalculate',
  authorize(['ADMIN', 'OPERATOR']),
  vendorPerformanceController.recalculateVendorPerformance
);

// Update vendor pricing for a product
router.post(
  '/:vendorId/pricing/:productId',
  authorize(['ADMIN', 'OPERATOR', 'VENDOR']),
  vendorPerformanceController.updateVendorPricing
);

module.exports = router;
