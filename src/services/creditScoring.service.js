const prisma = require('../config/database');
const logger = require('../utils/logger');

class CreditScoringService {
  // Score weights (must total 100%)
  static WEIGHTS = {
    PAYMENT_TIMELINESS: 0.40,    // 40%
    ORDER_CONSISTENCY: 0.20,      // 20%
    CREDIT_UTILIZATION: 0.20,     // 20%
    ACCOUNT_AGE: 0.10,            // 10%
    DISPUTE_RATE: 0.10,           // 10%
  };

  static MIN_SCORE = 300;
  static MAX_SCORE = 900;
  static BASE_SCORE = 500;

  /**
   * Calculate credit score for a retailer
   * Returns score (300-900) and detailed breakdown
   */
  async calculateCreditScore(retailerId) {
    try {
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId },
        include: {
          user: true,
          orders: {
            where: {
              status: { in: ['DELIVERED', 'COMPLETED', 'CANCELLED'] },
            },
            include: {
              payments: true,
            },
          },
        },
      });

      if (!retailer) {
        throw new Error('Retailer not found');
      }

      // Calculate each component
      const paymentScore = this.calculatePaymentTimeliness(retailer);
      const consistencyScore = this.calculateOrderConsistency(retailer);
      const utilizationScore = this.calculateCreditUtilization(retailer);
      const ageScore = this.calculateAccountAge(retailer);
      const disputeScore = this.calculateDisputeRate(retailer);

      // Calculate weighted total
      const totalScore = Math.round(
        paymentScore.score * CreditScoringService.WEIGHTS.PAYMENT_TIMELINESS +
        consistencyScore.score * CreditScoringService.WEIGHTS.ORDER_CONSISTENCY +
        utilizationScore.score * CreditScoringService.WEIGHTS.CREDIT_UTILIZATION +
        ageScore.score * CreditScoringService.WEIGHTS.ACCOUNT_AGE +
        disputeScore.score * CreditScoringService.WEIGHTS.DISPUTE_RATE
      );

      // Ensure score is within bounds
      const finalScore = Math.max(
        CreditScoringService.MIN_SCORE,
        Math.min(CreditScoringService.MAX_SCORE, totalScore)
      );

      const breakdown = {
        paymentTimeliness: paymentScore,
        orderConsistency: consistencyScore,
        creditUtilization: utilizationScore,
        accountAge: ageScore,
        disputeRate: disputeScore,
      };

      const explanation = this.generateExplanation(breakdown, finalScore);

      return {
        score: finalScore,
        breakdown,
        explanation,
        calculatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Credit score calculation failed', {
        retailerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Payment Timeliness (40%)
   * Measures how quickly retailer pays after delivery
   */
  calculatePaymentTimeliness(retailer) {
    const deliveredOrders = retailer.orders.filter(o => 
      o.status === 'DELIVERED' || o.status === 'COMPLETED'
    );

    if (deliveredOrders.length === 0) {
      return {
        score: CreditScoringService.BASE_SCORE,
        details: {
          totalOrders: 0,
          onTimePayments: 0,
          latePayments: 0,
          averageDelayDays: 0,
        },
        impact: 'neutral',
        reason: 'No payment history available',
      };
    }

    let onTimeCount = 0;
    let lateCount = 0;
    let totalDelayDays = 0;
    let paymentsAnalyzed = 0;

    deliveredOrders.forEach(order => {
      if (order.deliveredAt && order.payments.length > 0) {
        const firstPayment = order.payments.sort((a, b) => 
          new Date(a.createdAt) - new Date(b.createdAt)
        )[0];

        const deliveryDate = new Date(order.deliveredAt);
        const paymentDate = new Date(firstPayment.createdAt);
        const delayDays = Math.floor((paymentDate - deliveryDate) / (1000 * 60 * 60 * 24));

        totalDelayDays += Math.max(0, delayDays);
        paymentsAnalyzed++;

        if (delayDays <= 7) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      }
    });

    if (paymentsAnalyzed === 0) {
      return {
        score: CreditScoringService.BASE_SCORE,
        details: {
          totalOrders: deliveredOrders.length,
          onTimePayments: 0,
          latePayments: 0,
          averageDelayDays: 0,
        },
        impact: 'neutral',
        reason: 'No payments recorded yet',
      };
    }

    const onTimeRatio = onTimeCount / paymentsAnalyzed;
    const avgDelay = totalDelayDays / paymentsAnalyzed;

    // Score calculation
    let score = CreditScoringService.BASE_SCORE;

    // On-time ratio impact (up to +200 points)
    score += onTimeRatio * 200;

    // Average delay impact (penalty for delays)
    if (avgDelay > 30) {
      score -= 150;
    } else if (avgDelay > 14) {
      score -= 100;
    } else if (avgDelay > 7) {
      score -= 50;
    }

    // Consistency bonus (if 90%+ on time)
    if (onTimeRatio >= 0.9) {
      score += 100;
    }

    score = Math.max(300, Math.min(900, score));

    return {
      score,
      details: {
        totalOrders: paymentsAnalyzed,
        onTimePayments: onTimeCount,
        latePayments: lateCount,
        onTimeRatio: Math.round(onTimeRatio * 100),
        averageDelayDays: Math.round(avgDelay * 10) / 10,
      },
      impact: onTimeRatio >= 0.8 ? 'positive' : onTimeRatio >= 0.5 ? 'neutral' : 'negative',
      reason: onTimeRatio >= 0.8 
        ? 'Excellent payment history' 
        : onTimeRatio >= 0.5 
        ? 'Moderate payment delays' 
        : 'Frequent late payments',
    };
  }

  /**
   * Order Consistency (20%)
   * Measures regularity and volume of orders
   */
  calculateOrderConsistency(retailer) {
    const completedOrders = retailer.orders.filter(o => 
      o.status === 'DELIVERED' || o.status === 'COMPLETED'
    );

    if (completedOrders.length === 0) {
      return {
        score: CreditScoringService.BASE_SCORE,
        details: {
          totalOrders: 0,
          ordersPerMonth: 0,
          consistency: 0,
        },
        impact: 'neutral',
        reason: 'No order history',
      };
    }

    const sortedOrders = completedOrders.sort((a, b) => 
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    const firstOrder = new Date(sortedOrders[0].createdAt);
    const lastOrder = new Date(sortedOrders[sortedOrders.length - 1].createdAt);
    const daysSinceFirst = Math.max(1, (Date.now() - firstOrder) / (1000 * 60 * 60 * 24));
    const ordersPerMonth = (completedOrders.length / daysSinceFirst) * 30;

    // Calculate consistency (variance in order intervals)
    let intervals = [];
    for (let i = 1; i < sortedOrders.length; i++) {
      const interval = (new Date(sortedOrders[i].createdAt) - new Date(sortedOrders[i-1].createdAt)) / (1000 * 60 * 60 * 24);
      intervals.push(interval);
    }

    const avgInterval = intervals.length > 0 
      ? intervals.reduce((a, b) => a + b, 0) / intervals.length 
      : 0;

    const variance = intervals.length > 0
      ? intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
      : 0;

    const consistency = variance > 0 ? 1 / (1 + Math.sqrt(variance) / avgInterval) : 1;

    // Score calculation
    let score = CreditScoringService.BASE_SCORE;

    // Volume impact (up to +150 points)
    if (ordersPerMonth >= 8) {
      score += 150;
    } else if (ordersPerMonth >= 4) {
      score += 100;
    } else if (ordersPerMonth >= 2) {
      score += 50;
    }

    // Consistency impact (up to +100 points)
    score += consistency * 100;

    // Recent activity bonus
    const daysSinceLastOrder = (Date.now() - lastOrder) / (1000 * 60 * 60 * 24);
    if (daysSinceLastOrder <= 7) {
      score += 50;
    } else if (daysSinceLastOrder > 30) {
      score -= 50;
    }

    score = Math.max(300, Math.min(900, score));

    return {
      score,
      details: {
        totalOrders: completedOrders.length,
        ordersPerMonth: Math.round(ordersPerMonth * 10) / 10,
        consistency: Math.round(consistency * 100),
        daysSinceLastOrder: Math.round(daysSinceLastOrder),
      },
      impact: ordersPerMonth >= 4 ? 'positive' : ordersPerMonth >= 2 ? 'neutral' : 'negative',
      reason: ordersPerMonth >= 4 
        ? 'Regular ordering pattern' 
        : ordersPerMonth >= 2 
        ? 'Moderate order frequency' 
        : 'Infrequent orders',
    };
  }

  /**
   * Credit Utilization (20%)
   * Measures how much of available credit is being used
   */
  calculateCreditUtilization(retailer) {
    const creditLimit = parseFloat(retailer.creditLimit || 0);
    const outstandingDebt = parseFloat(retailer.outstandingDebt || 0);

    if (creditLimit === 0) {
      return {
        score: CreditScoringService.BASE_SCORE,
        details: {
          creditLimit: 0,
          outstandingDebt: 0,
          utilizationRatio: 0,
        },
        impact: 'neutral',
        reason: 'No credit limit assigned',
      };
    }

    const utilizationRatio = outstandingDebt / creditLimit;

    // Score calculation (lower utilization is better)
    let score = CreditScoringService.BASE_SCORE;

    if (utilizationRatio <= 0.30) {
      score += 200; // Excellent
    } else if (utilizationRatio <= 0.50) {
      score += 100; // Good
    } else if (utilizationRatio <= 0.70) {
      score += 0; // Fair
    } else if (utilizationRatio <= 0.90) {
      score -= 100; // Poor
    } else {
      score -= 200; // Very poor
    }

    score = Math.max(300, Math.min(900, score));

    return {
      score,
      details: {
        creditLimit,
        outstandingDebt,
        utilizationRatio: Math.round(utilizationRatio * 100),
        availableCredit: creditLimit - outstandingDebt,
      },
      impact: utilizationRatio <= 0.50 ? 'positive' : utilizationRatio <= 0.70 ? 'neutral' : 'negative',
      reason: utilizationRatio <= 0.30 
        ? 'Low credit utilization' 
        : utilizationRatio <= 0.70 
        ? 'Moderate credit utilization' 
        : 'High credit utilization',
    };
  }

  /**
   * Account Age (10%)
   * Measures how long the retailer has been active
   */
  calculateAccountAge(retailer) {
    const createdAt = new Date(retailer.createdAt);
    const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    const monthsSinceCreation = daysSinceCreation / 30;

    // Score calculation
    let score = CreditScoringService.BASE_SCORE;

    if (monthsSinceCreation >= 24) {
      score += 200; // 2+ years
    } else if (monthsSinceCreation >= 12) {
      score += 150; // 1-2 years
    } else if (monthsSinceCreation >= 6) {
      score += 100; // 6-12 months
    } else if (monthsSinceCreation >= 3) {
      score += 50; // 3-6 months
    }

    score = Math.max(300, Math.min(900, score));

    return {
      score,
      details: {
        accountAgeDays: Math.round(daysSinceCreation),
        accountAgeMonths: Math.round(monthsSinceCreation * 10) / 10,
        createdAt: retailer.createdAt,
      },
      impact: monthsSinceCreation >= 12 ? 'positive' : monthsSinceCreation >= 6 ? 'neutral' : 'negative',
      reason: monthsSinceCreation >= 12 
        ? 'Established account' 
        : monthsSinceCreation >= 6 
        ? 'Moderate account history' 
        : 'New account',
    };
  }

  /**
   * Dispute/Cancellation Rate (10%)
   * Measures order cancellations and disputes
   */
  calculateDisputeRate(retailer) {
    const totalOrders = retailer.orders.length;
    const cancelledOrders = retailer.orders.filter(o => o.status === 'CANCELLED').length;

    if (totalOrders === 0) {
      return {
        score: CreditScoringService.BASE_SCORE,
        details: {
          totalOrders: 0,
          cancelledOrders: 0,
          cancellationRate: 0,
        },
        impact: 'neutral',
        reason: 'No order history',
      };
    }

    const cancellationRate = cancelledOrders / totalOrders;

    // Score calculation (lower cancellation is better)
    let score = CreditScoringService.BASE_SCORE;

    if (cancellationRate === 0) {
      score += 200; // Perfect
    } else if (cancellationRate <= 0.05) {
      score += 150; // Excellent
    } else if (cancellationRate <= 0.10) {
      score += 100; // Good
    } else if (cancellationRate <= 0.20) {
      score += 0; // Fair
    } else {
      score -= 150; // Poor
    }

    score = Math.max(300, Math.min(900, score));

    return {
      score,
      details: {
        totalOrders,
        cancelledOrders,
        cancellationRate: Math.round(cancellationRate * 100),
      },
      impact: cancellationRate <= 0.10 ? 'positive' : cancellationRate <= 0.20 ? 'neutral' : 'negative',
      reason: cancellationRate === 0 
        ? 'No cancellations' 
        : cancellationRate <= 0.10 
        ? 'Low cancellation rate' 
        : 'High cancellation rate',
    };
  }

  /**
   * Generate human-readable explanation
   */
  generateExplanation(breakdown, finalScore) {
    const factors = [];

    // Identify positive factors
    Object.entries(breakdown).forEach(([key, value]) => {
      if (value.impact === 'positive') {
        factors.push(`+ ${value.reason}`);
      }
    });

    // Identify negative factors
    Object.entries(breakdown).forEach(([key, value]) => {
      if (value.impact === 'negative') {
        factors.push(`- ${value.reason}`);
      }
    });

    const scoreCategory = 
      finalScore >= 750 ? 'Excellent' :
      finalScore >= 650 ? 'Good' :
      finalScore >= 550 ? 'Fair' :
      finalScore >= 450 ? 'Poor' : 'Very Poor';

    return {
      category: scoreCategory,
      summary: `Credit score is ${finalScore} (${scoreCategory})`,
      factors,
      recommendation: this.getRecommendation(finalScore, breakdown),
    };
  }

  /**
   * Get recommendation based on score
   */
  getRecommendation(score, breakdown) {
    if (score >= 750) {
      return 'Eligible for credit limit increase. Consider offering better terms.';
    } else if (score >= 650) {
      return 'Good credit standing. Monitor for continued performance.';
    } else if (score >= 550) {
      return 'Fair credit. Encourage timely payments and consistent ordering.';
    } else if (score >= 450) {
      return 'Below average credit. Consider reducing credit limit or requiring advance payment.';
    } else {
      return 'Poor credit. Recommend cash-only transactions until score improves.';
    }
  }

  /**
   * Save score to history
   */
  async saveScoreHistory(retailerId, scoreData) {
    await prisma.creditScoreHistory.create({
      data: {
        retailerId,
        score: scoreData.score,
        paymentTimelinessScore: scoreData.breakdown.paymentTimeliness.score,
        orderConsistencyScore: scoreData.breakdown.orderConsistency.score,
        creditUtilizationScore: scoreData.breakdown.creditUtilization.score,
        accountAgeScore: scoreData.breakdown.accountAge.score,
        disputeRateScore: scoreData.breakdown.disputeRate.score,
        breakdown: scoreData.breakdown,
        explanation: scoreData.explanation,
      },
    });

    // Update retailer's current score
    await prisma.retailer.update({
      where: { id: retailerId },
      data: { creditScore: scoreData.score },
    });

    logger.info('Credit score saved', {
      retailerId,
      score: scoreData.score,
    });
  }

  /**
   * Get score history for trend analysis
   */
  async getScoreHistory(retailerId, days = 90) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await prisma.creditScoreHistory.findMany({
      where: {
        retailerId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get score trend (increasing, decreasing, stable)
   */
  async getScoreTrend(retailerId, days = 30) {
    const history = await this.getScoreHistory(retailerId, days);

    if (history.length < 2) {
      return { trend: 'insufficient_data', change: 0 };
    }

    const oldestScore = history[0].score;
    const latestScore = history[history.length - 1].score;
    const change = latestScore - oldestScore;

    let trend;
    if (change > 20) trend = 'increasing';
    else if (change < -20) trend = 'decreasing';
    else trend = 'stable';

    return {
      trend,
      change,
      oldestScore,
      latestScore,
      dataPoints: history.length,
    };
  }
}

module.exports = new CreditScoringService();
