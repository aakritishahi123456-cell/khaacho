const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { whatsappLogger } = require('../utils/logger');
const prisma = require('../config/database');
const queueManager = require('../utils/asyncQueue');
const monitoringService = require('./monitoring.service');

class WhatsAppService {
  constructor() {
    this.apiUrl = config.whatsapp.apiUrl;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.accessToken = config.whatsapp.accessToken;
    this.useAsync = config.whatsapp.async;
  }

  async sendMessage(to, message) {
    // Use async queue if enabled
    if (this.useAsync && config.features.asyncNotifications) {
      return await queueManager.addJob('whatsapp', 'send-message', {
        to,
        message,
        timestamp: Date.now(),
      });
    }

    // Synchronous sending
    return await this._sendMessageSync(to, message);
  }

  async _sendMessageSync(to, message) {
    const startTime = Date.now();
    
    try {
      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      const duration = Date.now() - startTime;
      
      await prisma.whatsAppMessage.create({
        data: {
          messageId: response.data.messages[0].id,
          from: this.phoneNumberId,
          to,
          body: message,
          type: 'text',
          status: 'sent',
          direction: 'OUTBOUND',
        },
      });

      whatsappLogger.info('WhatsApp message sent', {
        to,
        messageId: response.data.messages[0].id,
        duration,
      });

      // Track successful WhatsApp message
      try {
        await monitoringService.trackWhatsAppMessage(to, 'sent', duration);
      } catch (error) {
        // Don't fail message sending if monitoring fails
        console.error('Failed to track WhatsApp message:', error.message);
      }

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      whatsappLogger.error('WhatsApp send message error', {
        to,
        error: error.response?.data || error.message,
        duration,
      });
      
      // Track failed WhatsApp message
      try {
        await monitoringService.trackWhatsAppMessage(to, 'failed', duration);
      } catch (monitorError) {
        // Don't fail message sending if monitoring fails
        console.error('Failed to track WhatsApp failure:', monitorError.message);
      }
      
      // Don't throw error to prevent blocking main flow
      logger.warn('WhatsApp message failed, continuing...', { to });
      return null;
    }
  }

  async sendOrderConfirmation(order) {
    if (this.useAsync && config.features.asyncNotifications) {
      return await queueManager.addJob('whatsapp', 'order-confirmation', {
        order,
      });
    }

    const retailerPhone = order.retailer.user.phoneNumber;
    const vendorPhone = order.vendor?.user.phoneNumber;

    const itemsList = order.items
      .map(item => `${item.quantity}x ${item.productName} @ Rs.${item.unitPrice}`)
      .join('\n');

    const retailerMessage = `✅ Order Confirmed!\n\nOrder #${order.orderNumber}\nVendor: ${order.vendor?.user.businessName || 'TBD'}\n\nItems:\n${itemsList}\n\nSubtotal: Rs.${order.subtotal}\nTax: Rs.${order.taxAmount}\nTotal: Rs.${order.total}\n\nStatus: ${order.status}`;

    await this._sendMessageSync(retailerPhone, retailerMessage);

    if (vendorPhone) {
      const vendorMessage = `📦 New Order Received!\n\nOrder #${order.orderNumber}\nRetailer: ${order.retailer.user.businessName}\n\nItems:\n${itemsList}\n\nTotal: Rs.${order.total}\n\nPlease process this order.`;
      await this._sendMessageSync(vendorPhone, vendorMessage);
    }
  }

  async sendPaymentConfirmation(order, amount) {
    if (this.useAsync && config.features.asyncNotifications) {
      return await queueManager.addJob('whatsapp', 'payment-confirmation', {
        order,
        amount,
      });
    }

    const retailerPhone = order.retailer.user.phoneNumber;
    
    const message = `💰 Payment Received!\n\nOrder #${order.orderNumber}\nAmount Paid: Rs.${amount}\nRemaining: Rs.${order.dueAmount}\n\nThank you for your payment!`;

    await this._sendMessageSync(retailerPhone, message);
  }

  async handleIncomingMessage(messageData) {
    const { from, text, messageId } = messageData;

    // Store message
    await prisma.whatsAppMessage.create({
      data: {
        messageId,
        from,
        to: this.phoneNumberId,
        body: text,
        type: 'text',
        status: 'received',
        direction: 'INBOUND',
      },
    });

    whatsappLogger.info('Incoming WhatsApp message', { from, text });

    // Check if it's an order status query
    const orderNumberMatch = text.match(/(?:order|status|track)\s*#?([A-Z0-9]+)/i);
    if (orderNumberMatch) {
      const WhatsAppOrderParser = require('./whatsappOrderParser.service');
      const response = await WhatsAppOrderParser.handleOrderStatusQuery(from, orderNumberMatch[1]);
      await this.sendMessage(from, response);
      return;
    }

    // Check if message contains order items
    if (this.looksLikeOrder(text)) {
      const WhatsAppOrderParser = require('./whatsappOrderParser.service');
      const result = await WhatsAppOrderParser.parseAndCreateOrder({
        from,
        text,
        messageId,
      });

      if (!result.success) {
        await this.sendMessage(from, result.message);
      }
    } else {
      await this.sendMessage(
        from,
        `Welcome to Khaacho! 🛒\n\nTo place an order, send:\nSKU x Quantity\n\nExample:\nRICE-1KG x 10\nDAL-1KG x 5\n\nTo check order status:\nOrder #ORD260100001`
      );
    }
  }

  looksLikeOrder(text) {
    const orderPatterns = [
      /[A-Z0-9-]+\s*[xX×]\s*\d+/,
      /[A-Z0-9-]+\s*[-:]\s*\d+/,
      /\d+\s*[xX×]\s*[A-Z0-9-]+/,
    ];

    return orderPatterns.some(pattern => pattern.test(text));
  }
}

module.exports = new WhatsAppService();
