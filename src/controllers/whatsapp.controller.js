const config = require('../config');
const WhatsAppService = require('../services/whatsapp.service');
const recoveryService = require('../services/failureRecovery.service');
const queueManager = require('../queues/queueManager');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

class WhatsAppController {
  async webhook(req, res, next) {
    try {
      // CRITICAL: Store webhook event BEFORE processing
      // This ensures no data is lost if server crashes
      const webhookEvent = await recoveryService.storeWebhookEvent(
        'whatsapp',
        'message_received',
        req.body,
        req.headers
      );

      // Immediately respond to WhatsApp to prevent timeout
      res.sendStatus(200);

      // Process asynchronously
      try {
        const { entry } = req.body;

        if (entry && entry[0]?.changes) {
          const change = entry[0].changes[0];
          const value = change.value;

          if (value.messages && value.messages[0]) {
            const message = value.messages[0];
            
            // Mark as processing
            await recoveryService.markWebhookProcessing(webhookEvent.id);
            
            // Queue for processing (non-blocking)
            await queueManager.addJob('whatsapp', {
              eventId: webhookEvent.id,
              from: message.from,
              text: message.text?.body || '',
              messageId: message.id,
              timestamp: value.metadata?.timestamp,
            });
            
            // Mark as completed
            await recoveryService.markWebhookCompleted(webhookEvent.id);
          }
        }
      } catch (processingError) {
        // Log error but don't fail the webhook response
        logger.error('WhatsApp webhook processing error:', processingError);
        await recoveryService.markWebhookFailed(webhookEvent.id, processingError);
      }
    } catch (error) {
      logger.error('WhatsApp webhook storage error:', error);
      // Still respond 200 to prevent WhatsApp from retrying
      return res.sendStatus(200);
    }
  }

  async verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      logger.info('WhatsApp webhook verified');
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  }
}

module.exports = new WhatsAppController();
