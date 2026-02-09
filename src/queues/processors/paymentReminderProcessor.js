const { PrismaClient } = require('@prisma/client');
const whatsappService = require('../../services/whatsapp.service');
const logger = require('../../utils/logger');
const monitoringService = require('../../services/monitoring.service');

const prisma = new PrismaClient();

/**
 * Payment Reminder Processor
 * Handles sending payment reminders for overdue orders
 */
async function paymentReminderProcessor(job) {
  const { retailerId, orderId, reminderType } = job.data;

  logger.info(`Processing payment reminder job ${job.id}`, {
    retailerId,
    orderId,
    reminderType,
  });

  try {
    // Get retailer and order details
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
      include: {
        user: true,
      },
    });

    if (!retailer) {
      throw new Error(`Retailer ${retailerId} not found`);
    }

    let orders;
    if (orderId) {
      // Specific order reminder
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      orders = [order];
    } else {
      // All overdue orders for retailer
      orders = await prisma.order.findMany({
        where: {
          retailerId,
          paymentStatus: 'OVERDUE',
        },
        include: {
          items: true,
        },
      });
    }

    if (orders.length === 0) {
      logger.info(`No overdue orders found for retailer ${retailerId}`);
      return {
        success: true,
        retailerId,
        ordersProcessed: 0,
      };
    }

    // Calculate total overdue amount
    const totalOverdue = orders.reduce((sum, order) => sum + Number(order.dueAmount), 0);

    // Send WhatsApp reminder
    const reminderData = {
      retailerName: retailer.user.name,
      shopName: retailer.shopName,
      totalOverdue,
      orderCount: orders.length,
      orders: orders.map(o => ({
        orderNumber: o.orderNumber,
        dueAmount: Number(o.dueAmount),
        dueDate: o.expectedDelivery,
      })),
      reminderType,
    };

    await whatsappService.sendPaymentReminder(retailer.user.phoneNumber, reminderData);

    // Log reminder sent
    await prisma.$executeRawUnsafe(
      `INSERT INTO payment_reminders_log (retailer_id, order_id, reminder_type, amount, sent_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, CURRENT_TIMESTAMP)`,
      retailerId,
      orderId || null,
      reminderType,
      totalOverdue
    );

    logger.info(`Payment reminder job ${job.id} completed`, {
      retailerId,
      ordersProcessed: orders.length,
      totalOverdue,
    });

    // Track job completion
    try {
      await monitoringService.trackJobCompleted('payment-reminder', job.id, true);
    } catch (error) {
      console.error('Failed to track job completion:', error.message);
    }

    return {
      success: true,
      retailerId,
      ordersProcessed: orders.length,
      totalOverdue,
    };
  } catch (error) {
    logger.error(`Payment reminder job ${job.id} failed`, {
      error: error.message,
      retailerId,
      orderId,
    });

    // Track job failure
    try {
      await monitoringService.trackJobCompleted('payment-reminder', job.id, false, error.message);
    } catch (monitorError) {
      console.error('Failed to track job failure:', monitorError.message);
    }

    throw error; // Will trigger retry
  }
}

module.exports = paymentReminderProcessor;
