const express = require('express');
const DashboardController = require('../controllers/dashboard.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/admin',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  DashboardController.getAdminDashboard.bind(DashboardController)
);

router.get(
  '/vendor',
  authenticate,
  authorize('VENDOR'),
  DashboardController.getVendorDashboard.bind(DashboardController)
);

router.get(
  '/retailer',
  authenticate,
  authorize('RETAILER'),
  DashboardController.getRetailerDashboard.bind(DashboardController)
);

module.exports = router;
