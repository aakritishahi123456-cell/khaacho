const express = require('express');
const CreditController = require('../controllers/credit.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.post('/payment', authenticate, authorize('VENDOR', 'ADMIN'), CreditController.paymentValidation, validate, CreditController.recordPayment.bind(CreditController));
router.get('/history', authenticate, CreditController.getCreditHistory.bind(CreditController));
router.get('/score/:retailerId?', authenticate, CreditController.getCreditScore.bind(CreditController));

module.exports = router;
