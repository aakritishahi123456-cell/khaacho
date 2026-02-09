const express = require('express');
const AdminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Retailer management
router.get(
  '/retailers',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AdminController.getRetailers.bind(AdminController)
);

router.post(
  '/retailers/:id/approve',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AdminController.approveRetailerValidation,
  validate,
  AdminController.approveRetailer.bind(AdminController)
);

router.patch(
  '/retailers/:id/credit-limit',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AdminController.updateCreditLimitValidation,
  validate,
  AdminController.updateCreditLimit.bind(AdminController)
);

// Vendor management
router.get(
  '/vendors',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AdminController.getVendors.bind(AdminController)
);

router.post(
  '/vendors/:id/approve',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AdminController.approveVendor.bind(AdminController)
);

// Payment management
router.get(
  '/payments',
  authenticate,
  authorize('ADMIN', 'OPERATOR'),
  AdminController.getPayments.bind(AdminController)
);

module.exports = router;
