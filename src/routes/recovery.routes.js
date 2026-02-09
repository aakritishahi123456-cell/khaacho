const express = require('express');
const router = express.Router();
const recoveryController = require('../controllers/recovery.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All recovery routes require admin authentication
router.use(authenticate);
router.use(authorize(['ADMIN']));

// Recovery dashboard
router.get('/dashboard', recoveryController.getDashboard);

// Webhook events
router.get('/webhook-events/pending', recoveryController.getPendingWebhookEvents);
router.get('/webhook-events/failed', recoveryController.getFailedWebhookEvents);

// Workflows
router.get('/workflows/incomplete', recoveryController.getIncompleteWorkflows);

// Order recoveries
router.get('/orders/pending', recoveryController.getPendingOrderRecoveries);
router.get('/orders/:orderId/retries', recoveryController.getVendorAssignmentRetries);

// Manual actions
router.post('/trigger', recoveryController.triggerRecovery);
router.post('/cleanup', recoveryController.runCleanup);

module.exports = router;
