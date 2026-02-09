const express = require('express');
const orderRoutingController = require('../controllers/orderRouting.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/order-routing/:orderId/route
 * @desc    Route order to vendor (automatic or manual override)
 * @access  Admin, Vendor
 * @body    vendorId (optional for manual), overrideReason (optional)
 */
router.post('/:orderId/route', authorize(['ADMIN', 'VENDOR']), orderRoutingController.routeOrder);

/**
 * @route   GET /api/v1/order-routing/:orderId/logs
 * @desc    Get routing logs for an order
 * @access  Admin, Vendor
 */
router.get('/:orderId/logs', authorize(['ADMIN', 'VENDOR']), orderRoutingController.getRoutingLogs);

/**
 * @route   GET /api/v1/order-routing/:orderId/acceptance-status
 * @desc    Get vendor acceptance status for an order
 * @access  Admin, Vendor
 */
router.get('/:orderId/acceptance-status', authorize(['ADMIN', 'VENDOR']), orderRoutingController.getAcceptanceStatus);

/**
 * @route   POST /api/v1/order-routing/acceptance/:acceptanceId/respond
 * @desc    Vendor accepts or rejects order
 * @access  Vendor
 * @body    response (ACCEPTED|REJECTED), reason (if rejected)
 */
router.post('/acceptance/:acceptanceId/respond', authorize(['VENDOR']), orderRoutingController.respondToOrder);

/**
 * @route   POST /api/v1/order-routing/:orderId/fallback
 * @desc    Manually trigger fallback routing
 * @access  Admin
 */
router.post('/:orderId/fallback', authorize(['ADMIN']), orderRoutingController.triggerFallback);

/**
 * @route   GET /api/v1/order-routing/config
 * @desc    Get routing configuration
 * @access  Admin
 */
router.get('/config', authorize(['ADMIN']), orderRoutingController.getRoutingConfig);

/**
 * @route   PUT /api/v1/order-routing/config/:configKey
 * @desc    Update routing configuration
 * @access  Admin
 * @body    configValue
 */
router.put('/config/:configKey', authorize(['ADMIN']), orderRoutingController.updateRoutingConfig);

/**
 * @route   GET /api/v1/order-routing/vendor-scores
 * @desc    Get all vendor routing scores
 * @access  Admin, Vendor
 */
router.get('/vendor-scores', authorize(['ADMIN', 'VENDOR']), orderRoutingController.getVendorScores);

module.exports = router;
