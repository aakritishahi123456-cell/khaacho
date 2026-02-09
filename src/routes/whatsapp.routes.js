const express = require('express');
const WhatsAppController = require('../controllers/whatsapp.controller');

const router = express.Router();

router.get('/webhook', WhatsAppController.verifyWebhook.bind(WhatsAppController));
router.post('/webhook', WhatsAppController.webhook.bind(WhatsAppController));

module.exports = router;
