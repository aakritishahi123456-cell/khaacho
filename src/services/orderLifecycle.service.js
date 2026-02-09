const prisma = require('../config/database');
const logger = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../utils/errors');
const CreditService = require('./credit.service');
const WhatsAppService = require('./whatsapp.service');

class OrderLifecycleService {
  // Valid state transitions
  static TRANSITIONS = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['VENDOR_ASSIGNED', 'CANCELLED'],
    VENDOR_ASSIGNED: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  async createDraftOrder(retailerId, items, notes = null, whatsappMessageId = null) {
    logger.info('Creating draft order', { retailerId, itemCount: items.length });

    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
      include: { user: true },
    });

    if (!retailer || !retailer.user.isActive) {
      throw new NotFoundError('Retailer not found or inactive');
    }

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const vendorProduct = await prisma.vendorProduct.findUnique({
        where: { id: item.vendorProductId },
        include: {
          product: true,
          vendor: true,
        },
      });

      if (!vendorProduct || !vendorProduct.isAvailable) {
        throw new ValidationError(`Product ${item.vendorProductId} not available`);
      }

      if (vendorProduct.stock < item.quantity) {
        throw new ValidationError(`Insufficient stock for ${vendorProduct.product.name}`);
      }

      const itemSubtotal = parseFloat(vendorProduct.vendorPrice) * item.quantity;
      const taxRate = 0.13; // 13% VAT
      const taxAmount = itemSubtotal * taxRate;
      const itemTotal = itemSubtotal + taxAmount;

      subtotal += itemSubtotal;

      orderItems.push({
        productId: vendorProduct.productId,
        productName: vendorProduct.product.name,
        productSku: vendorProduct.sku,
        quantity: item.quantity,
        unitPrice: vendorProduct.vendorPrice,
        discount: 0,
        taxRate: taxRate,
        taxAmount: taxAmount,
        subtotal: itemSubtotal,
        total: itemTotal,
      });
    }

    const taxAmount = subtotal * 0.13;
    const total = subtotal + taxAmount;
    const orderNumber = await this.generateOrderNumber();

    // Create draft order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        retailerId,
        vendorId: orderItems[0].vendorId || null, // Will be assigned later
        status: 'DRAFT',
        paymentStatus: 'PENDING',
        subtotal,
        taxAmount,
        total,
        dueAmount: total,
        notes,
        whatsappMessageId,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        retailer: {
          include: { user: true },
        },
      },
    });

    // Log transition
    await this.logTransition(order.id, null, 'DRAFT', null, 'Order created from WhatsApp');

    // Send confirmation to retailer
    await WhatsAppService.sendMessage(
      retailer.user.phoneNumber,
      `📝 Draft Order Created!\n\nOrder #${orderNumber}\nTotal: Rs.${total}\n\nYour order is being reviewed by our team. You'll be notified once confirmed.`
    );

    logger.info('Draft order created', { orderId: order.id, orderNumber });
    return order;
  }

  async confirmOrder(orderId, confirmedBy) {
    const order = await this.getOrderWithDetails(orderId);
    await this.validateTransition(order, 'CONFIRMED');

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: this.getOrderIncludes(),
    });

    await this.logTransition(orderId, 'DRAFT', 'CONFIRMED', confirmedBy, 'Order confirmed by admin');

    // Notify retailer
    await WhatsAppService.sendMessage(
      order.retailer.user.phoneNumber,
      `✅ Order Confirmed!\n\nOrder #${order.orderNumber}\nTotal: Rs.${order.total}\n\nWe're now assigning a vendor to fulfill your order.`
    );

    logger.info('Order confirmed', { orderId, confirmedBy });
    return updatedOrder;
  }

  async assignVendor(orderId, vendorId, assignedBy) {
    const order = await this.getOrderWithDetails(orderId);
    await this.validateTransition(order, 'VENDOR_ASSIGNED');

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!vendor || !vendor.user.isActive) {
      throw new NotFoundError('Vendor not found or inactive');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        vendorId,
        status: 'VENDOR_ASSIGNED',
      },
      include: this.getOrderIncludes(),
    });

    await this.logTransition(
      orderId,
      'CONFIRMED',
      'VENDOR_ASSIGNED',
      assignedBy,
      `Vendor ${vendor.user.businessName} assigned`
    );

    // Notify vendor
    const itemsList = order.items
      .map(item => `${item.quantity}x ${item.productName} @ Rs.${item.unitPrice}`)
      .join('\n');

    await WhatsAppService.sendMessage(
      vendor.user.phoneNumber,
      `📦 New Order Assigned!\n\nOrder #${order.orderNumber}\nRetailer: ${order.retailer.user.businessName}\n\nItems:\n${itemsList}\n\nTotal: Rs.${order.total}\n\nPlease accept or reject this order.`
    );

    // Notify retailer
    await WhatsAppService.sendMessage(
      order.retailer.user.phoneNumber,
      `🏪 Vendor Assigned!\n\nOrder #${order.orderNumber}\nVendor: ${vendor.user.businessName}\n\nYour order has been assigned to a vendor for fulfillment.`
    );

    logger.info('Vendor assigned', { orderId, vendorId, assignedBy });
    return updatedOrder;
  }

  async acceptOrder(orderId, acceptedBy) {
    const order = await this.getOrderWithDetails(orderId);
    await this.validateTransition(order, 'ACCEPTED');

    // Reserve stock
    for (const item of order.items) {
      const vendorProduct = await prisma.vendorProduct.findFirst({
        where: {
          vendorId: order.vendorId,
          productId: item.productId,
        },
      });

      if (!vendorProduct || vendorProduct.stock < item.quantity) {
        throw new ValidationError(`Insufficient stock for ${item.productName}`);
      }

      await prisma.vendorProduct.update({
        where: { id: vendorProduct.id },
        data: {
          stock: { decrement: item.quantity },
        },
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'ACCEPTED',
      },
      include: this.getOrderIncludes(),
    });

    await this.logTransition(orderId, 'VENDOR_ASSIGNED', 'ACCEPTED', acceptedBy, 'Order accepted by vendor');

    // Create credit ledger entry
    await CreditService.recordTransaction({
      retailerId: order.retailerId,
      vendorId: order.vendorId,
      orderId: order.id,
      transactionType: 'ORDER_CREDIT',
      amount: order.total,
      description: `Order ${order.orderNumber} - Credit`,
    });

    // Update retailer stats
    await prisma.retailer.update({
      where: { id: order.retailerId },
      data: {
        outstandingDebt: { increment: order.total },
      },
    });

    // Notify retailer
    await WhatsAppService.sendMessage(
      order.retailer.user.phoneNumber,
      `✅ Order Accepted!\n\nOrder #${order.orderNumber}\nVendor: ${order.vendor.user.businessName}\n\nYour order has been accepted and will be dispatched soon.`
    );

    logger.info('Order accepted', { orderId, acceptedBy });
    return updatedOrder;
  }

  async dispatchOrder(orderId, dispatchedBy, expectedDelivery = null) {
    const order = await this.getOrderWithDetails(orderId);
    await this.validateTransition(order, 'DISPATCHED');

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DISPATCHED',
        shippedAt: new Date(),
        expectedDelivery,
      },
      include: this.getOrderIncludes(),
    });

    await this.logTransition(orderId, 'ACCEPTED', 'DISPATCHED', dispatchedBy, 'Order dispatched for delivery');

    // Notify retailer
    const deliveryMsg = expectedDelivery
      ? `\nExpected Delivery: ${new Date(expectedDelivery).toLocaleDateString()}`
      : '';

    await WhatsAppService.sendMessage(
      order.retailer.user.phoneNumber,
      `🚚 Order Dispatched!\n\nOrder #${order.orderNumber}${deliveryMsg}\n\nYour order is on the way!`
    );

    logger.info('Order dispatched', { orderId, dispatchedBy });
    return updatedOrder;
  }

  async deliverOrder(orderId, deliveredBy) {
    const order = await this.getOrderWithDetails(orderId);
    await this.validateTransition(order, 'DELIVERED');

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
      include: this.getOrderIncludes(),
    });

    await this.logTransition(orderId, 'DISPATCHED', 'DELIVERED', deliveredBy, 'Order delivered to retailer');

    // Update retailer stats
    await prisma.retailer.update({
      where: { id: order.retailerId },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: order.total },
        lastOrderAt: new Date(),
      },
    });

    // Notify retailer
    await WhatsAppService.sendMessage(
      order.retailer.user.phoneNumber,
      `📦 Order Delivered!\n\nOrder #${order.orderNumber}\nTotal: Rs.${order.total}\n\nThank you for your order!`
    );

    logger.info('Order delivered', { orderId, deliveredBy });
    return updatedOrder;
  }

  async completeOrder(orderId, completedBy) {
    const order = await this.getOrderWithDetails(orderId);
    await this.validateTransition(order, 'COMPLETED');

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
      },
      include: this.getOrderIncludes(),
    });

    await this.logTransition(orderId, 'DELIVERED', 'COMPLETED', completedBy, 'Order completed successfully');

    // Update vendor stats
    await prisma.vendor.update({
      where: { id: order.vendorId },
      data: {
        totalSales: { increment: order.total },
      },
    });

    // Recalculate credit score
    await CreditService.calculateCreditScore(order.retailerId);

    logger.info('Order completed', { orderId, completedBy });
    return updatedOrder;
  }

  async cancelOrder(orderId, cancelledBy, reason) {
    const order = await this.getOrderWithDetails(orderId);
    
    if (order.status === 'CANCELLED') {
      throw new ValidationError('Order is already cancelled');
    }

    if (order.status === 'COMPLETED') {
      throw new ValidationError('Cannot cancel completed order');
    }

    const previousStatus = order.status;

    // Restore stock if order was accepted
    if (['ACCEPTED', 'DISPATCHED', 'DELIVERED'].includes(order.status)) {
      for (const item of order.items) {
        const vendorProduct = await prisma.vendorProduct.findFirst({
          where: {
            vendorId: order.vendorId,
            productId: item.productId,
          },
        });

        if (vendorProduct) {
          await prisma.vendorProduct.update({
            where: { id: vendorProduct.id },
            data: {
              stock: { increment: item.quantity },
            },
          });
        }
      }

      // Reverse credit ledger entry
      await CreditService.recordTransaction({
        retailerId: order.retailerId,
        vendorId: order.vendorId,
        orderId: order.id,
        transactionType: 'REFUND_DEBIT',
        amount: order.dueAmount,
        description: `Order ${order.orderNumber} - Cancelled`,
      });

      // Update retailer debt
      await prisma.retailer.update({
        where: { id: order.retailerId },
        data: {
          outstandingDebt: { decrement: order.dueAmount },
        },
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: this.getOrderIncludes(),
    });

    await this.logTransition(orderId, previousStatus, 'CANCELLED', cancelledBy, reason);

    // Notify retailer
    await WhatsAppService.sendMessage(
      order.retailer.user.phoneNumber,
      `❌ Order Cancelled\n\nOrder #${order.orderNumber}\nReason: ${reason}\n\nPlease contact us if you have any questions.`
    );

    // Notify vendor if assigned
    if (order.vendor) {
      await WhatsAppService.sendMessage(
        order.vendor.user.phoneNumber,
        `❌ Order Cancelled\n\nOrder #${order.orderNumber}\nReason: ${reason}`
      );
    }

    logger.info('Order cancelled', { orderId, cancelledBy, reason });
    return updatedOrder;
  }

  async validateTransition(order, newStatus) {
    const validTransitions = OrderLifecycleService.TRANSITIONS[order.status];
    
    if (!validTransitions.includes(newStatus)) {
      throw new ValidationError(
        `Invalid transition from ${order.status} to ${newStatus}. Valid transitions: ${validTransitions.join(', ')}`
      );
    }
  }

  async logTransition(orderId, fromStatus, toStatus, userId, notes) {
    await prisma.orderStatusLog.create({
      data: {
        orderId,
        fromStatus,
        toStatus,
        changedBy: userId,
        notes,
      },
    });

    logger.info('Order status transition', {
      orderId,
      fromStatus,
      toStatus,
      userId,
    });
  }

  async getOrderWithDetails(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: this.getOrderIncludes(),
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return order;
  }

  getOrderIncludes() {
    return {
      items: {
        include: { product: true },
      },
      retailer: {
        include: { user: true },
      },
      vendor: {
        include: { user: true },
      },
    };
  }

  async generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    const count = await prisma.order.count();
    const sequence = (count + 1).toString().padStart(6, '0');
    
    return `ORD${year}${month}${sequence}`;
  }

  async getOrderStatusHistory(orderId) {
    return await prisma.orderStatusLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        changedByUser: {
          select: {
            name: true,
            role: true,
          },
        },
      },
    });
  }
}

module.exports = new OrderLifecycleService();
