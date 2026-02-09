const prisma = require('../config/database');
const logger = require('../utils/logger');
const OrderLifecycleService = require('./orderLifecycle.service');

class WhatsAppOrderParserService {
  async parseAndCreateOrder(message) {
    const { from, text, messageId } = message;

    logger.info('Parsing WhatsApp order', { from, text });

    // Identify retailer by phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber: from },
      include: { retailerProfile: true },
    });

    if (!user || user.role !== 'RETAILER' || !user.retailerProfile) {
      logger.warn('Order from non-retailer', { from });
      return {
        success: false,
        message: 'Only registered retailers can place orders. Please contact admin.',
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        message: 'Your account is inactive. Please contact admin.',
      };
    }

    // Parse order items from message
    const items = this.parseOrderItems(text);

    if (items.length === 0) {
      return {
        success: false,
        message: 'Could not parse order items. Please use format:\nSKU1 x Quantity1\nSKU2 x Quantity2',
      };
    }

    // Validate and fetch products
    const validatedItems = [];
    const errors = [];

    for (const item of items) {
      const vendorProduct = await prisma.vendorProduct.findFirst({
        where: {
          sku: item.sku,
          isAvailable: true,
        },
        include: {
          product: true,
          vendor: true,
        },
      });

      if (!vendorProduct) {
        errors.push(`Product ${item.sku} not found`);
        continue;
      }

      if (vendorProduct.stock < item.quantity) {
        errors.push(`${vendorProduct.product.name}: Only ${vendorProduct.stock} available`);
        continue;
      }

      validatedItems.push({
        vendorProductId: vendorProduct.id,
        quantity: item.quantity,
        vendorId: vendorProduct.vendorId,
      });
    }

    if (validatedItems.length === 0) {
      return {
        success: false,
        message: `No valid items found.\n${errors.join('\n')}`,
      };
    }

    // Create draft order
    try {
      const order = await OrderLifecycleService.createDraftOrder(
        user.retailerProfile.id,
        validatedItems,
        text,
        messageId
      );

      return {
        success: true,
        order,
        message: `Draft order created: ${order.orderNumber}`,
      };
    } catch (error) {
      logger.error('Error creating draft order', { error: error.message, from });
      return {
        success: false,
        message: `Error creating order: ${error.message}`,
      };
    }
  }

  parseOrderItems(text) {
    const items = [];
    const lines = text.split('\n');

    // Pattern: SKU x Quantity or SKU-Quantity or SKU:Quantity
    const patterns = [
      /([A-Z0-9-]+)\s*[xX×]\s*(\d+)/,  // RICE-1KG x 10
      /([A-Z0-9-]+)\s*[-:]\s*(\d+)/,   // RICE-1KG-10 or RICE-1KG:10
      /(\d+)\s*[xX×]\s*([A-Z0-9-]+)/,  // 10 x RICE-1KG
    ];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          let sku, quantity;
          
          if (pattern.source.startsWith('(\\d+)')) {
            // Quantity first
            quantity = parseInt(match[1], 10);
            sku = match[2].toUpperCase();
          } else {
            // SKU first
            sku = match[1].toUpperCase();
            quantity = parseInt(match[2], 10);
          }

          if (quantity > 0) {
            items.push({ sku, quantity });
            break;
          }
        }
      }
    }

    return items;
  }

  async handleOrderStatusQuery(from, orderNumber) {
    const user = await prisma.user.findUnique({
      where: { phoneNumber: from },
      include: { retailerProfile: true },
    });

    if (!user || !user.retailerProfile) {
      return 'Only registered retailers can check order status.';
    }

    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        retailerId: user.retailerProfile.id,
      },
      include: {
        vendor: {
          include: { user: true },
        },
      },
    });

    if (!order) {
      return `Order ${orderNumber} not found.`;
    }

    const statusEmoji = {
      DRAFT: '📝',
      CONFIRMED: '✅',
      VENDOR_ASSIGNED: '🏪',
      ACCEPTED: '👍',
      DISPATCHED: '🚚',
      DELIVERED: '📦',
      COMPLETED: '✔️',
      CANCELLED: '❌',
    };

    const vendorInfo = order.vendor
      ? `\nVendor: ${order.vendor.user.businessName}`
      : '';

    return `${statusEmoji[order.status]} Order Status\n\nOrder #${orderNumber}\nStatus: ${order.status}${vendorInfo}\nTotal: Rs.${order.total}\nPaid: Rs.${order.paidAmount}\nDue: Rs.${order.dueAmount}`;
  }
}

module.exports = new WhatsAppOrderParserService();
