const { whatsappQueue } = require('../queues');
const WhatsAppService = require('../services/whatsapp.service');
const { whatsappLogger } = require('../utils/logger');

// Process WhatsApp notification jobs
whatsappQueue.process('send-message', 10, async (job) => {
  const { to, message, metadata } = job.data;
  
  const startTime = Date.now();
  
  try {
    whatsappLogger.info('Processing WhatsApp message', {
      jobId: job.id,
      to,
      messageLength: message.length,
    });

    await WhatsAppService.sendMessage(to, message);
    
    const duration = Date.now() - startTime;
    whatsappLogger.info('WhatsApp message sent', {
      jobId: job.id,
      to,
      duration,
    });

    return { success: true, duration };
  } catch (error) {
    whatsappLogger.error('WhatsApp message failed', {
      jobId: job.id,
      to,
      error: error.message,
      duration: Date.now() - startTime,
    });
    throw error;
  }
});

// Process order confirmation notifications
whatsappQueue.process('order-confirmation', 5, async (job) => {
  const { order } = job.data;
  
  try {
    await WhatsAppService.sendOrderConfirmation(order);
    return { success: true };
  } catch (error) {
    whatsappLogger.error('Order confirmation failed', {
      jobId: job.id,
      orderId: order.id,
      error: error.message,
    });
    throw error;
  }
});

// Process payment confirmation notifications
whatsappQueue.process('payment-confirmation', 5, async (job) => {
  const { order, amount } = job.data;
  
  try {
    await WhatsAppService.sendPaymentConfirmation(order, amount);
    return { success: true };
  } catch (error) {
    whatsappLogger.error('Payment confirmation failed', {
      jobId: job.id,
      orderId: order.id,
      error: error.message,
    });
    throw error;
  }
});

whatsappLogger.info('WhatsApp worker started');

module.exports = whatsappQueue;
