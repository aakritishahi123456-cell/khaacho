const whatsappService = require('../../services/whatsapp.service');
const logger = require('../../utils/logger');
const monitoringService = require('../../services/monitoring.service');

/**
 * WhatsApp Message Processor
 * Handles sending WhatsApp messages asynchronously
 */
async function whatsappProcessor(job) {
  const { messageType, recipient, data } = job.data;

  logger.info(`Processing WhatsApp job ${job.id}`, {
    messageType,
    recipient,
  });

  try {
    let result;

    switch (messageType) {
      case 'ORDER_CONFIRMATION':
        result = await whatsappService.sendOrderConfirmation(recipient, data);
        break;

      case 'VENDOR_NOTIFICATION':
        result = await whatsappService.sendVendorNotification(recipient, data);
        break;

      case 'DELIVERY_UPDATE':
        result = await whatsappService.sendDeliveryUpdate(recipient, data);
        break;

      case 'PAYMENT_REMINDER':
        result = await whatsappService.sendPaymentReminder(recipient, data);
        break;

      case 'BALANCE_INQUIRY_RESPONSE':
        result = await whatsappService.sendBalanceInquiryResponse(recipient, data);
        break;

      case 'GENERIC_MESSAGE':
        result = await whatsappService.sendMessage(recipient, data.message);
        break;

      default:
        throw new Error(`Unknown message type: ${messageType}`);
    }

    logger.info(`WhatsApp job ${job.id} completed successfully`, {
      messageType,
      result,
    });

    // Track job completion
    try {
      await monitoringService.trackJobCompleted('whatsapp', job.id, true);
    } catch (error) {
      console.error('Failed to track job completion:', error.message);
    }

    return {
      success: true,
      messageType,
      recipient,
      result,
    };
  } catch (error) {
    logger.error(`WhatsApp job ${job.id} failed`, {
      error: error.message,
      messageType,
      recipient,
    });

    // Track job failure
    try {
      await monitoringService.trackJobCompleted('whatsapp', job.id, false, error.message);
    } catch (monitorError) {
      console.error('Failed to track job failure:', monitorError.message);
    }

    throw error; // Will trigger retry
  }
}

module.exports = whatsappProcessor;
