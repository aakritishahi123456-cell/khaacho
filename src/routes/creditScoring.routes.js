const express = require('express');
const creditScoringController = require('../controllers/creditScoring.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get current credit score for a retailer
router.get('/:retailerId', creditScoringController.getRetailerScore);

// Get credit score history
router.get('/:retailerId/history', creditScoringController.getScoreHistory);

// Get credit score trend
router.get('/:retailerId/trend', creditScoringController.getScoreTrend);

// Admin-only routes
router.post(
  '/:retailerId/recalculate',
  authorize(['ADMIN', 'OPERATOR']),
  creditScoringController.recalculateScore
);

router.post(
  '/recalculate-all',
  authorize(['ADMIN']),
  creditScoringController.recalculateAllScores
);

router.get(
  '/worker-status',
  authorize(['ADMIN']),
  creditScoringController.getWorkerStatus
);

router.get(
  '/distribution',
  authorize(['ADMIN', 'OPERATOR']),
  creditScoringController.getScoreDistribution
);

module.exports = router;
