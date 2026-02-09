const prisma = require('../config/database');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

class CreditService {
  async checkCreditLimit(retailerId, orderAmount) {
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
    });

    if (!retailer) {
      throw new NotFoundError('Retailer not found');
    }

    const availableCredit = parseFloat(retailer.creditLimit) - parseFloat(retailer.outstandingDebt);
    const canProceed = availableCredit >= parseFloat(orderAmount);

    return {
      canProceed,
      creditLimit: retailer.creditLimit,
      outstanderEntry = await prisma.creditLedger.create({
      data: {
        retailerId,
        vendorId,
        orderId,
        transactionType,
        amount,
        balance: newBalance,
        description,
        referenceNumber,
      },
    });

    return ledgerEntry;
  }

  async recordPayment(orderId, amount, referenceNumber = null) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (amount > order.dueAmount) {
      throw new Error('Payment amount exceeds due amount');
    }

    const newPaidAmount = parseFloat(order.paidAmount) + parseFloat(amount);
    const newDueAmount = parseFloat(order.dueAmount) - parseFloat(amount);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paidAmount: newPaidAmount,
        dueAmount: newDueAmount,
        paymentStatus: newDueAmount === 0 ? 'PAID' : 'PARTIAL',
      },
    });

    await this.recordTransaction({
      retailerId: order.retailerId,
      vendorId: order.vendorId,
      orderId,
      transactionType: 'PAYMENT',
      amount,
      description: `Payment for order ${order.orderNumber}`,
      referenceNumber,
    });

    await prisma.retailer.update({
      where: { id: order.retailerId },
      data: {
        outstandingDebt: { decrement: amount },
      },
    });

    return order;
  }

  async getCreditHistory(retailerId, vendorId = null, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { retailerId };
    
    if (vendorId) {
      where.vendorId = vendorId;
    }

    const [entries, total] = await Promise.all([
      prisma.creditLedger.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: true,
          vendor: {
            include: { user: true },
          },
        },
      }),
      prisma.creditLedger.count({ where }),
    ]);

    return {
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async calculateCreditScore(retailerId) {
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
      include: {
        orders: {
          where: { status: 'DELIVERED' },
        },
      },
    });

    if (!retailer) {
      throw new NotFoundError('Retailer not found');
    }

    let score = 500; // Base score

    // Payment history (40%)
    const paidOrders = retailer.orders.filter(o => o.paymentStatus === 'PAID').length;
    const totalOrders = retailer.orders.length;
    if (totalOrders > 0) {
      score += Math.floor((paidOrders / totalOrders) * 400);
    }

    // Outstanding debt ratio (30%)
    const debtRatio = parseFloat(retailer.outstandingDebt) / (parseFloat(retailer.totalSpent) || 1);
    if (debtRatio < 0.1) score += 300;
    else if (debtRatio < 0.3) score += 200;
    else if (debtRatio < 0.5) score += 100;

    // Order volume (20%)
    if (totalOrders > 100) score += 200;
    else if (totalOrders > 50) score += 150;
    else if (totalOrders > 20) score += 100;
    else if (totalOrders > 10) score += 50;

    // Account age (10%)
    const accountAge = Date.now() - new Date(retailer.createdAt).getTime();
    const daysOld = accountAge / (1000 * 60 * 60 * 24);
    if (daysOld > 365) score += 100;
    else if (daysOld > 180) score += 75;
    else if (daysOld > 90) score += 50;
    else if (daysOld > 30) score += 25;

    score = Math.min(Math.max(score, 300), 900);

    await prisma.retailer.update({
      where: { id: retailerId },
      data: { creditScore: score },
    });

    return score;
  }
}

module.exports = new CreditService();
