const express = require('express');
const queueController = require('../controllers/queue.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['ADMIN']));

// Get queue statistics
router.get('/stats', queueController.getQueueStats);

// Get available queue keys
router.get('/keys', queueController.getQueueKeys);

// Get failed jobs for a queue
router.get('/:queueKey/failed', queueController.getFailedJobs);

// Retry a failed job
router.post('/:queueKey/jobs/:jobId/retry', queueController.retryJob);

// Clean old jobs from a queue
router.post('/:queueKey/clean', queueController.cleanQueue);

// Pause a queue
router.post('/:queueKey/pause', queueController.pauseQueue);

// Resume a queue
router.post('/:queueKey/resume', queueController.resumeQueue);

module.exports = router;
