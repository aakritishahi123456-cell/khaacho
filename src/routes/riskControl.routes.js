const express = require('express');
const riskControlController = require('../controllers/riskControl.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/risk-control/dashboard
 * @desc    Get risk control dashboard summary
 * @access  Admin only
 */
router.get('/dashboard', authorize(['ADMIN']), riskControlController.getRiskDashboard);

/**
 * @route   GET /api/v1/risk-control/configs
 * @desc    Get all risk configurations
 * @access  Admin only
 */
router.get('/configs', authorize(['ADMIN']), riskControlController.getRiskConfigs);

/**
 * @route   PUT /api/v1/risk-control/configs/:configKey
 * @desc    Update risk configuration
 * @access  Admin only
 */
router.put('/configs/:configKey', authorize(['ADMIN']), riskControlController.updateRiskConfig);

/**
 * @route   GET /api/v1/risk-control/alerts
 * @desc    Get risk alerts with filters
 * @access  Admin, Vendor
 */
router.get('/alerts', authorize(['ADMIN', 'VENDOR']), riskControlController.getRiskAlerts);

/**
 * @route   PUT /api/v1/risk-control/alerts/:alertId/acknowledge
 * @desc    Acknowledge a risk alert
 * @access  Admin only
 */
router.put('/alerts/:alertId/acknowledge', authorize(['ADMIN']), riskControlController.acknowledgeAlert);

/**
 * @route   GET /api/v1/risk-control/retailers/:retailerId/score
 * @desc    Get retailer risk score
 * @access  Admin, Vendor (own retailers only)
 */
router.get('/retailers/:retailerId/score', authorize(['ADMIN', 'VENDOR']), riskControlController.getRetailerRiskScore);

/**
 * @route   POST /api/v1/risk-control/retailers/:retailerId/calculate
 * @desc    Calculate retailer risk score
 * @access  Admin, Vendor
 */
router.post('/retailers/:retailerId/calculate', authorize(['ADMIN', 'VENDOR']), riskControlController.calculateRiskScore);

/**
 * @route   POST /api/v1/risk-control/retailers/:retailerId/apply-controls
 * @desc    Apply automated risk controls for a retailer
 * @access  Admin only
 */
router.post('/retailers/:retailerId/apply-controls', authorize(['ADMIN']), riskControlController.applyAutomatedControls);

/**
 * @route   GET /api/v1/risk-control/retailers/:retailerId/actions
 * @desc    Get risk actions history for a retailer
 * @access  Admin, Vendor
 */
router.get('/retailers/:retailerId/actions', authorize(['ADMIN', 'VENDOR']), riskControlController.getRiskActions);

module.exports = router;
