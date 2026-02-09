const express = require('express');
const financialExportController = require('../controllers/financialExport.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin/vendor access
router.use(authenticate);
router.use(authorize(['ADMIN', 'VENDOR']));

/**
 * @route   GET /api/v1/financial-export/credit-summary
 * @desc    Generate retailer credit summary report
 * @access  Admin, Vendor
 * @query   retailerId, startDate, endDate, minCreditScore, maxCreditScore, format (json|csv|pdf-json)
 */
router.get('/credit-summary', financialExportController.generateCreditSummary);

/**
 * @route   GET /api/v1/financial-export/purchase-volume
 * @desc    Generate monthly purchase volume report
 * @access  Admin, Vendor
 * @query   retailerId, year, month, format (json|csv|pdf-json)
 */
router.get('/purchase-volume', financialExportController.generatePurchaseVolume);

/**
 * @route   GET /api/v1/financial-export/payment-discipline
 * @desc    Generate payment discipline report
 * @access  Admin, Vendor
 * @query   retailerId, startDate, endDate, minScore, maxScore, format (json|csv|pdf-json)
 */
router.get('/payment-discipline', financialExportController.generatePaymentDiscipline);

/**
 * @route   GET /api/v1/financial-export/outstanding-liability
 * @desc    Generate outstanding liability report
 * @access  Admin, Vendor
 * @query   retailerId, minAmount, maxAmount, overdueOnly, format (json|csv|pdf-json)
 */
router.get('/outstanding-liability', financialExportController.generateOutstandingLiability);

/**
 * @route   GET /api/v1/financial-export/combined
 * @desc    Generate combined financial report (all reports)
 * @access  Admin, Vendor
 * @query   retailerId, startDate, endDate, format (json|pdf-json)
 */
router.get('/combined', financialExportController.generateCombinedReport);

module.exports = router;
