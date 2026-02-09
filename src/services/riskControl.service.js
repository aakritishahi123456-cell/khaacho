const prisma = require('../config/database');
const logger = require('../utils/logger');

class RiskControlService {
  /**
   * Get risk configuration
   */
  async getRiskConfig(configKey) {
    const config = await prisma.riskConfig.findUnique({
      where: { configKey, isActive: true },
    });
    return config ? config.configValue : null;
  }

  /**
   * Update risk configuration (admin only)
   */
  async updateRiskConfig(configKey, configValue, updatedBy) {
    const config = await prisma.riskConfig.update({
      where: { configKey },
      data: {
        configValue,
        updatedBy,
        updatedAt: new Date(),
      },
    });

    logger.info('Risk config updated', { configKey, updatedBy });
    return config;
  }

  /**
   * Calculate retailer risk score
   */
  async calculateRetailerRiskScore(retailerId) {
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        payments: {
          where: { isReversed: false },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!retailer) {
      throw new Error('Retailer not found');
    }

    // Get risk score weights
    const weights = await this.getRiskConfig('risk_score_weights') || {
      payment_delay: 40,
      credit_utilization: 30,
      order_pattern: 20,
      overdue_amount: 10,
    };

    // Calculate component scores
    const paymentDelayScore = await this._calculatePaymentDelayScore(retailer);
    const creditUtilizationScore = this._calculateCreditUtilizationScore(retailer);
    const orderPatternScore = await this._calculateOrderPatternScore(retailer);
    const overdueScore = this._calculateOverdueScore(retailer);

    // Calculate weighted risk score (0-100)
    const riskScore = (
      (paymentDelayScore * weights.payment_delay / 100) +
      (creditUtilizationScore * weights.credit_utilization / 100) +
      (orderPatternScore * weights.order_pattern / 100) +
      (overdueScore * weights.overdue_amount / 100)
    );

    // Determine risk level
    let riskLevel = 'LOW';
    if (riskScore >= 70) riskLevel = 'CRITICAL';
    else if (riskScore >= 50) riskLevel = 'HIGH';
    else if (riskScore >= 30) riskLevel = 'MEDIUM';

    // Calculate overdue metrics
    const overdueOrders = retailer.orders.filter(o => 
      o.paymentStatus === 'OVERDUE' || o.paymentStatus === 'PARTIAL'
    );
    const overdueAmount = overdueOrders.reduce((sum, o) => sum + Number(o.dueAmount), 0);
    const daysOverdue = this._calculateMaxDaysOverdue(overdueOrders);
    const consecutiveDelays = await this._calculateConsecutiveDelays(retailerId);

    // Save or update risk score
    const riskScoreData = await prisma.retailerRiskScore.upsert({
      where: { retailerId },
      update: {
        riskScore,
        riskLevel,
        paymentDelayScore,
        creditUtilizationScore,
        orderPatternScore,
        overdueAmount,
        daysOverdue,
        consecutiveDelays,
        lastCalculatedAt: new Date(),
      },
      create: {
        retailerId,
        riskScore,
        riskLevel,
        paymentDelayScore,
        creditUtilizationScore,
        orderPatternScore,
        overdueAmount,
        daysOverdue,
        consecutiveDelays,
      },
    });

    logger.info('Risk score calculated', {
      retailerId,
      riskScore: riskScore.toFixed(2),
      riskLevel,
    });

    return riskScoreData;
  }

  /**
   * Check and apply automated risk controls
   */
  async applyAutomatedControls(retailerId) {
    const riskScore = await this.calculateRetailerRiskScore(retailerId);
    const actions = [];

    // 1. Check payment delay threshold
    const paymentDelayConfig = await this.getRiskConfig('payment_delay_threshold');
    if (paymentDelayConfig && riskScore.consecutiveDelays >= 3) {
      const action = await this._reduceCreditLimit(
        retailerId,
        paymentDelayConfig.credit_reduction_percent,
        'PAYMENT_DELAY',
        `Consecutive payment delays: ${riskScore.consecutiveDelays}`
      );
      if (action) actions.push(action);
    }

    // 2. Check credit overdue blocking
    const overdueConfig = await this.getRiskConfig('credit_overdue_blocking');
    if (overdueConfig && riskScore.daysOverdue >= overdueConfig.block_threshold_days) {
      const action = await this._blockNewOrders(
        retailerId,
        'CREDIT_OVERDUE',
        `Payment overdue for ${riskScore.daysOverdue} days`
      );
      if (action) actions.push(action);
    }

    // 3. Check high-risk thresholds
    const highRiskConfig = await this.getRiskConfig('high_risk_thresholds');
    if (highRiskConfig && riskScore.riskScore >= highRiskConfig.risk_score_threshold) {
      await this._createHighRiskAlert(retailerId, riskScore);
    }

    // 4. Check unusual order spikes
    const unusualActivity = await this._detectUnusualOrderSpike(retailerId);
    if (unusualActivity) {
      await this._createUnusualActivityAlert(retailerId, unusualActivity);
    }

    return { riskScore, actions };
  }

  /**
   * Reduce credit limit automatically
   */
  async _reduceCreditLimit(retailerId, reductionPercent, triggeredBy, reason) {
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
    });

    const creditLimitRules = await this.getRiskConfig('credit_limit_rules');
    const minCreditLimit = creditLimitRules?.min_credit_limit || 10000;
    const maxReduction = creditLimitRules?.max_reduction_percent || 50;

    const actualReduction = Math.min(reductionPercent, maxReduction);
    const newCreditLimit = Math.max(
      Number(retailer.creditLimit) * (1 - actualReduction / 100),
      minCreditLimit
    );

    if (newCreditLimit >= Number(retailer.creditLimit)) {
      return null; // No reduction needed
    }

    // Update credit limit
    await prisma.retailer.update({
      where: { id: retailerId },
      data: { creditLimit: newCreditLimit },
    });

    // Log action
    const action = await prisma.riskAction.create({
      data: {
        actionType: 'CREDIT_LIMIT_REDUCED',
        retailerId,
        triggeredBy,
        previousValue: { creditLimit: Number(retailer.creditLimit) },
        newValue: { creditLimit: newCreditLimit },
        reason,
        isAutomatic: true,
      },
    });

    // Create alert
    await prisma.riskAlert.create({
      data: {
        alertType: 'CREDIT_LIMIT_REDUCED',
        severity: 'HIGH',
        retailerId,
        title: 'Credit Limit Automatically Reduced',
        description: `Credit limit reduced from ${retailer.creditLimit} to ${newCreditLimit} due to ${reason}`,
        metadata: { action: action.id, reductionPercent: actualReduction },
      },
    });

    logger.warn('Credit limit reduced automatically', {
      retailerId,
      oldLimit: Number(retailer.creditLimit),
      newLimit: newCreditLimit,
      reason,
    });

    return action;
  }

  /**
   * Block new orders for retailer
   */
  async _blockNewOrders(retailerId, triggeredBy, reason) {
    // Update retailer to inactive
    await prisma.retailer.update({
      where: { id: retailerId },
      data: { isApproved: false },
    });

    // Log action
    const action = await prisma.riskAction.create({
      data: {
        actionType: 'ORDER_BLOCKED',
        retailerId,
        triggeredBy,
        reason,
        isAutomatic: true,
      },
    });

    // Create critical alert
    await prisma.riskAlert.create({
      data: {
        alertType: 'ORDER_BLOCKED',
        severity: 'CRITICAL',
        retailerId,
        title: 'New Orders Blocked',
        description: `New orders blocked for retailer due to ${reason}`,
        metadata: { action: action.id },
      },
    });

    logger.error('Orders blocked automatically', { retailerId, reason });

    return action;
  }

  /**
   * Create high-risk retailer alert
   */
  async _createHighRiskAlert(retailerId, riskScore) {
    const existingAlert = await prisma.riskAlert.findFirst({
      where: {
        retailerId,
        alertType: 'HIGH_RISK_RETAILER',
        isAcknowledged: false,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
      },
    });

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    await prisma.riskAlert.create({
      data: {
        alertType: 'HIGH_RISK_RETAILER',
        severity: riskScore.riskLevel,
        retailerId,
        title: 'High-Risk Retailer Detected',
        description: `Retailer has a risk score of ${riskScore.riskScore} (${riskScore.riskLevel}). Overdue: ${riskScore.overdueAmount}, Days overdue: ${riskScore.daysOverdue}`,
        metadata: {
          riskScore: Number(riskScore.riskScore),
          riskLevel: riskScore.riskLevel,
          overdueAmount: Number(riskScore.overdueAmount),
          daysOverdue: riskScore.daysOverdue,
        },
      },
    });

    logger.warn('High-risk retailer alert created', {
      retailerId,
      riskScore: Number(riskScore.riskScore),
    });
  }

  /**
   * Detect unusual order spikes
   */
  async _detectUnusualOrderSpike(retailerId) {
    const config = await this.getRiskConfig('unusual_order_detection') || {
      spike_multiplier: 3,
      spike_window_days: 7,
      min_orders_for_baseline: 5,
    };

    const windowStart = new Date(Date.now() - config.spike_window_days * 24 * 60 * 60 * 1000);
    const baselineStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get recent orders
    const recentOrders = await prisma.order.count({
      where: {
        retailerId,
        createdAt: { gte: windowStart },
        status: { notIn: ['CANCELLED'] },
      },
    });

    // Get baseline average
    const baselineOrders = await prisma.order.count({
      where: {
        retailerId,
        createdAt: { gte: baselineStart, lt: windowStart },
        status: { notIn: ['CANCELLED'] },
      },
    });

    if (baselineOrders < config.min_orders_for_baseline) {
      return null; // Not enough data
    }

    const baselineAvg = baselineOrders / 4; // 4 weeks
    const recentAvg = recentOrders;

    if (recentAvg >= baselineAvg * config.spike_multiplier) {
      return {
        recentOrders: recentAvg,
        baselineAvg,
        multiplier: (recentAvg / baselineAvg).toFixed(2),
      };
    }

    return null;
  }

  /**
   * Create unusual activity alert
   */
  async _createUnusualActivityAlert(retailerId, activityData) {
    await prisma.riskAlert.create({
      data: {
        alertType: 'UNUSUAL_SPIKE',
        severity: 'MEDIUM',
        retailerId,
        title: 'Unusual Order Activity Detected',
        description: `Order volume is ${activityData.multiplier}x higher than baseline (${activityData.recentOrders} vs ${activityData.baselineAvg} avg)`,
        metadata: activityData,
      },
    });

    // Update unusual activity count
    await prisma.retailerRiskScore.update({
      where: { retailerId },
      data: {
        unusualActivityCount: { increment: 1 },
      },
    });

    logger.info('Unusual activity alert created', { retailerId, activityData });
  }

  /**
   * Calculate payment delay score (0-100)
   */
  async _calculatePaymentDelayScore(retailer) {
    const payments = retailer.payments || [];
    if (payments.length === 0) return 0;

    let totalDelay = 0;
    let delayedPayments = 0;

    for (const payment of payments) {
      if (payment.processedAt && payment.createdAt) {
        const delayDays = Math.floor(
          (new Date(payment.processedAt) - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24)
        );
        if (delayDays > 7) {
          totalDelay += delayDays;
          delayedPayments++;
        }
      }
    }

    if (delayedPayments === 0) return 0;

    const avgDelay = totalDelay / delayedPayments;
    const delayRatio = delayedPayments / payments.length;

    // Score increases with average delay and ratio of delayed payments
    return Math.min(100, (avgDelay / 30) * 50 + delayRatio * 50);
  }

  /**
   * Calculate credit utilization score (0-100)
   */
  _calculateCreditUtilizationScore(retailer) {
    if (Number(retailer.creditLimit) === 0) return 0;

    const utilization = Number(retailer.outstandingDebt) / Number(retailer.creditLimit);
    
    // Score increases exponentially as utilization approaches 100%
    if (utilization >= 1) return 100;
    if (utilization >= 0.9) return 80 + (utilization - 0.9) * 200;
    if (utilization >= 0.7) return 50 + (utilization - 0.7) * 150;
    return utilization * 70;
  }

  /**
   * Calculate order pattern score (0-100)
   */
  async _calculateOrderPatternScore(retailer) {
    const orders = retailer.orders || [];
    if (orders.length < 3) return 0;

    let irregularityScore = 0;

    // Check for cancelled orders
    const cancelledRatio = orders.filter(o => o.status === 'CANCELLED').length / orders.length;
    irregularityScore += cancelledRatio * 40;

    // Check for incomplete orders
    const incompleteRatio = orders.filter(o => 
      ['DRAFT', 'CONFIRMED'].includes(o.status) && 
      new Date(o.createdAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length / orders.length;
    irregularityScore += incompleteRatio * 30;

    // Check for order value volatility
    const orderValues = orders.map(o => Number(o.total));
    const avgValue = orderValues.reduce((a, b) => a + b, 0) / orderValues.length;
    const variance = orderValues.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / orderValues.length;
    const volatility = Math.sqrt(variance) / avgValue;
    irregularityScore += Math.min(30, volatility * 30);

    return Math.min(100, irregularityScore);
  }

  /**
   * Calculate overdue score (0-100)
   */
  _calculateOverdueScore(retailer) {
    const overdueAmount = Number(retailer.outstandingDebt);
    if (overdueAmount === 0) return 0;

    // Score based on overdue amount relative to credit limit
    const overdueRatio = overdueAmount / Number(retailer.creditLimit);
    return Math.min(100, overdueRatio * 100);
  }

  /**
   * Calculate maximum days overdue
   */
  _calculateMaxDaysOverdue(overdueOrders) {
    if (overdueOrders.length === 0) return 0;

    const maxDays = Math.max(...overdueOrders.map(order => {
      if (!order.expectedDelivery) return 0;
      return Math.floor((Date.now() - new Date(order.expectedDelivery)) / (1000 * 60 * 60 * 24));
    }));

    return Math.max(0, maxDays);
  }

  /**
   * Calculate consecutive payment delays
   */
  async _calculateConsecutiveDelays(retailerId) {
    const recentPayments = await prisma.payment.findMany({
      where: { retailerId, isReversed: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    let consecutiveDelays = 0;
    for (const payment of recentPayments) {
      if (payment.processedAt && payment.createdAt) {
        const delayDays = Math.floor(
          (new Date(payment.processedAt) - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24)
        );
        if (delayDays > 7) {
          consecutiveDelays++;
        } else {
          break; // Stop at first on-time payment
        }
      }
    }

    return consecutiveDelays;
  }

  /**
   * Get all risk alerts
   */
  async getRiskAlerts(filters = {}) {
    const where = {};
    
    if (filters.severity) where.severity = filters.severity;
    if (filters.alertType) where.alertType = filters.alertType;
    if (filters.retailerId) where.retailerId = filters.retailerId;
    if (filters.isAcknowledged !== undefined) where.isAcknowledged = filters.isAcknowledged;

    return prisma.riskAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
    });
  }

  /**
   * Acknowledge risk alert
   */
  async acknowledgeAlert(alertId, acknowledgedBy) {
    return prisma.riskAlert.update({
      where: { id: alertId },
      data: {
        isAcknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Get risk actions history
   */
  async getRiskActions(retailerId, limit = 50) {
    return prisma.riskAction.findMany({
      where: { retailerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get retailer risk score
   */
  async getRetailerRiskScore(retailerId) {
    return prisma.retailerRiskScore.findUnique({
      where: { retailerId },
    });
  }

  /**
   * Get all risk configurations
   */
  async getAllRiskConfigs() {
    return prisma.riskConfig.findMany({
      where: { isActive: true },
      orderBy: { configKey: 'asc' },
    });
  }
}

module.exports = new RiskControlService();
