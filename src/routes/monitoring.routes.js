const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoring.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Public health check (no auth required)
router.get('/health', monitoringController.getSystemHealth);

// Admin-only monitoring routes
router.use(authenticate);
router.use(authorize('ADMIN'));

// Metrics
router.get('/metrics', monitoringController.getMetrics);
router.post('/metrics/reset', monitoringController.resetMetrics);

// Alerts
router.get('/alerts', monitoringController.getActiveAlerts);
router.post('/alerts/:alertId/acknowledge', monitoringController.acknowledgeAlert);
router.post('/alerts/:alertId/resolve', monitoringController.resolveAlert);
router.get('/alerts/statistics', monitoringController.getAlertStatistics);

// Dashboard
router.get('/dashboard', monitoringController.getDashboard);

module.exports = router;
