const prisma = require('../config/database');
const logger = require('../utils/logger');
const riskControlService = require('./riskControl.service');
const creditScoringService = require('./creditScoring.service');

class FinancialExportService {
  /**
   * Generate Retailer Credit Summary Report
   */
  async generateRetailerCreditSummary(filters = {}) {
    const { retailerId, startDate, endDate, minCreditScore, maxCreditScore } = filters;

    const where = {
      deletedAt: null,
      isApproved: true,
    };

    if (retailerId) where.id = retailerId;

    // Get retailers with all related data
    const retailers = await prisma.retailer.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            phoneNumber: true,
            email: true,
            businessName: true,
            address: true,
            city: true,
            state: true,
          },
        },
        orders: {
          where: {
            createdAt: startDate || endDate ? {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            } : undefined,
          },
          select: {
            id: true,
            total: true,
            paidAmount: true,
            dueAmount: true,
            status: true,
            paymentStatus: true,
            createdAt: true,
            deliveredAt: true,
          },
        },
        payments: {
          where: {
            createdAt: startDate || endDate ? {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            } : undefined,
            isReversed: false,
          },
          select: {
            amount: true,
            paymentMethod: true,
            processedAt: true,
            createdAt: true,
          },
        },
      },
    });

    const reportData = [];

    for (const retailer of retailers) {
      // Get credit score
      let creditScore = await creditScoringService.calculateCreditScore(retailer.id);
      
      // Get risk score
      let riskScore = await riskControlService.getRetailerRiskScore(retailer.id);
      if (!riskScore) {
        riskScore = await riskControlService.calculateRetailerRiskScore(retailer.id);
      }

      // Filter by credit score if specified
      if (minCreditScore && creditScore.score < minCreditScore) continue;
      if (maxCreditScore && creditScore.score > maxCreditScore) continue;

      // Calculate payment metrics
      const paymentMetrics = this._calculatePaymentMetrics(retailer.payments);
      
      // Calculate reliability rating
      const reliabilityRating = this._calculateReliabilityRating(
        creditScore.score,
        riskScore.riskScore,
        paymentMetrics
      );

      reportData.push({
        retailerDetails: {
          retailerId: retailer.id,
          retailerCode: retailer.retailerCode,
          name: retailer.user.name,
          businessName: retailer.user.businessName,
          shopName: retailer.shopName,
          phoneNumber: retailer.user.phoneNumber,
          email: retailer.user.email,
          address: retailer.user.address,
          city: retailer.user.city,
          state: retailer.user.state,
          gstNumber: retailer.gstNumber,
          panNumber: retailer.panNumber,
        },
        creditInformation: {
          creditLimit: Number(retailer.creditLimit),
          availableCredit: Number(retailer.availableCredit),
          outstandingDebt: Number(retailer.outstandingDebt),
          creditUtilization: retailer.creditLimit > 0 
            ? ((Number(retailer.outstandingDebt) / Number(retailer.creditLimit)) * 100).toFixed(2)
            : 0,
        },
        creditScore: {
          score: creditScore.score,
          grade: this._getCreditGrade(creditScore.score),
          components: {
            paymentTimeliness: creditScore.paymentTimelinessScore,
            orderConsistency: creditScore.orderConsistencyScore,
            creditUtilization: creditScore.creditUtilizationScore,
            accountAge: creditScore.accountAgeScore,
          },
        },
        riskAssessment: {
          riskScore: Number(riskScore.riskScore),
          riskLevel: riskScore.riskLevel,
          daysOverdue: riskScore.daysOverdue,
          consecutiveDelays: riskScore.consecutiveDelays,
        },
        paymentHistory: paymentMetrics,
        reliabilityRating: reliabilityRating,
        reportMetadata: {
          generatedAt: new Date().toISOString(),
          periodStart: startDate || 'All time',
          periodEnd: endDate || 'Current',
          totalOrders: retailer.orders.length,
          totalPayments: retailer.payments.length,
        },
      });
    }

    return reportData;
  }

  /**
   * Generate Monthly Purchase Volume Report
   */
  async generateMonthlyPurchaseVolume(filters = {}) {
    const { retailerId, year, month } = filters;

    const startDate = year && month 
      ? new Date(year, month - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);

    const where = {
      deletedAt: null,
      isApproved: true,
    };

    if (retailerId) where.id = retailerId;

    const retailers = await prisma.retailer.findMany({
      where,
      include: {
        user: true,
        orders: {
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: { notIn: ['CANCELLED'] },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    const reportData = [];

    for (const retailer of retailers) {
      const ordersByStatus = this._groupOrdersByStatus(retailer.orders);
      const productBreakdown = this._calculateProductBreakdown(retailer.orders);
      
      const totalPurchaseValue = retailer.orders.reduce((sum, order) => 
        sum + Number(order.total), 0
      );

      const avgOrderValue = retailer.orders.length > 0 
        ? totalPurchaseValue / retailer.orders.length 
        : 0;

      reportData.push({
        retailerDetails: {
          retailerId: retailer.id,
          retailerCode: retailer.retailerCode,
          name: retailer.user.name,
          businessName: retailer.user.businessName,
          shopName: retailer.shopName,
        },
        periodInformation: {
          month: startDate.toLocaleString('default', { month: 'long' }),
          year: startDate.getFullYear(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        purchaseMetrics: {
          totalOrders: retailer.orders.length,
          totalPurchaseValue: totalPurchaseValue.toFixed(2),
          averageOrderValue: avgOrderValue.toFixed(2),
          ordersByStatus: ordersByStatus,
        },
        productBreakdown: productBreakdown,
        creditInformation: {
          creditLimit: Number(retailer.creditLimit),
          creditUsedThisMonth: totalPurchaseValue.toFixed(2),
          outstandingDebt: Number(retailer.outstandingDebt),
        },
      });
    }

    return reportData;
  }

  /**
   * Generate Payment Discipline Report
   */
  async generatePaymentDisciplineReport(filters = {}) {
    const { retailerId, startDate, endDate, minScore, maxScore } = filters;

    const where = {
      deletedAt: null,
      isApproved: true,
    };

    if (retailerId) where.id = retailerId;

    const retailers = await prisma.retailer.findMany({
      where,
      include: {
        user: true,
        orders: {
          where: {
            createdAt: startDate || endDate ? {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            } : undefined,
          },
          select: {
            id: true,
            orderNumber: true,
            total: true,
            paidAmount: true,
            dueAmount: true,
            paymentStatus: true,
            createdAt: true,
            confirmedAt: true,
            deliveredAt: true,
            expectedDelivery: true,
          },
        },
        payments: {
          where: {
            createdAt: startDate || endDate ? {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            } : undefined,
            isReversed: false,
          },
          select: {
            amount: true,
            paymentMethod: true,
            createdAt: true,
            processedAt: true,
            orderId: true,
          },
        },
      },
    });

    const reportData = [];

    for (const retailer of retailers) {
      const paymentDiscipline = this._analyzePaymentDiscipline(
        retailer.orders,
        retailer.payments
      );

      // Filter by discipline score if specified
      if (minScore && paymentDiscipline.disciplineScore < minScore) continue;
      if (maxScore && paymentDiscipline.disciplineScore > maxScore) continue;

      const creditScore = await creditScoringService.calculateCreditScore(retailer.id);

      reportData.push({
        retailerDetails: {
          retailerId: retailer.id,
          retailerCode: retailer.retailerCode,
          name: retailer.user.name,
          businessName: retailer.user.businessName,
          shopName: retailer.shopName,
          phoneNumber: retailer.user.phoneNumber,
        },
        paymentDiscipline: paymentDiscipline,
        creditScore: {
          score: creditScore.score,
          grade: this._getCreditGrade(creditScore.score),
          paymentTimelinessScore: creditScore.paymentTimelinessScore,
        },
        creditInformation: {
          creditLimit: Number(retailer.creditLimit),
          outstandingDebt: Number(retailer.outstandingDebt),
        },
        reliabilityRating: this._calculateReliabilityRating(
          creditScore.score,
          100 - paymentDiscipline.disciplineScore,
          paymentDiscipline
        ),
      });
    }

    return reportData;
  }

  /**
   * Generate Outstanding Liability Report
   */
  async generateOutstandingLiabilityReport(filters = {}) {
    const { retailerId, minAmount, maxAmount, overdueOnly } = filters;

    const where = {
      deletedAt: null,
      isApproved: true,
    };

    if (retailerId) where.id = retailerId;
    if (minAmount) where.outstandingDebt = { gte: parseFloat(minAmount) };
    if (maxAmount) where.outstandingDebt = { ...where.outstandingDebt, lte: parseFloat(maxAmount) };

    const retailers = await prisma.retailer.findMany({
      where,
      include: {
        user: true,
        orders: {
          where: {
            paymentStatus: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
            dueAmount: { gt: 0 },
          },
          select: {
            id: true,
            orderNumber: true,
            total: true,
            paidAmount: true,
            dueAmount: true,
            paymentStatus: true,
            createdAt: true,
            deliveredAt: true,
            expectedDelivery: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        creditLedgers: {
          where: {
            transactionType: 'ORDER_CREDIT',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
      },
    });

    const reportData = [];

    for (const retailer of retailers) {
      if (overdueOnly && Number(retailer.outstandingDebt) === 0) continue;

      const liabilityBreakdown = this._calculateLiabilityBreakdown(retailer.orders);
      const agingAnalysis = this._calculateAgingAnalysis(retailer.orders);
      
      const riskScore = await riskControlService.getRetailerRiskScore(retailer.id);
      const creditScore = await creditScoringService.calculateCreditScore(retailer.id);

      reportData.push({
        retailerDetails: {
          retailerId: retailer.id,
          retailerCode: retailer.retailerCode,
          name: retailer.user.name,
          businessName: retailer.user.businessName,
          shopName: retailer.shopName,
          phoneNumber: retailer.user.phoneNumber,
          email: retailer.user.email,
        },
        liabilitySummary: {
          totalOutstanding: Number(retailer.outstandingDebt).toFixed(2),
          creditLimit: Number(retailer.creditLimit).toFixed(2),
          availableCredit: Number(retailer.availableCredit).toFixed(2),
          creditUtilization: retailer.creditLimit > 0 
            ? ((Number(retailer.outstandingDebt) / Number(retailer.creditLimit)) * 100).toFixed(2)
            : 0,
        },
        liabilityBreakdown: liabilityBreakdown,
        agingAnalysis: agingAnalysis,
        riskAssessment: {
          riskScore: riskScore ? Number(riskScore.riskScore) : 0,
          riskLevel: riskScore ? riskScore.riskLevel : 'UNKNOWN',
          daysOverdue: riskScore ? riskScore.daysOverdue : 0,
        },
        creditScore: {
          score: creditScore.score,
          grade: this._getCreditGrade(creditScore.score),
        },
        reliabilityRating: this._calculateReliabilityRating(
          creditScore.score,
          riskScore ? Number(riskScore.riskScore) : 50,
          { onTimePaymentRate: 0 }
        ),
        recentTransactions: retailer.creditLedgers.slice(0, 5).map(ledger => ({
          date: ledger.createdAt,
          type: ledger.transactionType,
          amount: Number(ledger.amount),
          balance: Number(ledger.runningBalance),
        })),
      });
    }

    return reportData;
  }

  /**
   * Export data to CSV format
   */
  exportToCSV(data, reportType) {
    if (!data || data.length === 0) {
      return '';
    }

    const headers = this._getCSVHeaders(reportType);
    const rows = data.map(item => this._formatCSVRow(item, reportType));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Export data to PDF-ready JSON format
   */
  exportToPDFJSON(data, reportType) {
    return {
      reportType,
      generatedAt: new Date().toISOString(),
      totalRecords: data.length,
      data: data,
      metadata: {
        format: 'PDF-ready JSON',
        version: '1.0',
        currency: 'NPR',
      },
    };
  }

  // Helper Methods

  _calculatePaymentMetrics(payments) {
    if (!payments || payments.length === 0) {
      return {
        totalPayments: 0,
        totalPaid: 0,
        averagePaymentAmount: 0,
        onTimePayments: 0,
        latePayments: 0,
        onTimePaymentRate: 0,
        averagePaymentDelay: 0,
      };
    }

    let totalPaid = 0;
    let onTimePayments = 0;
    let latePayments = 0;
    let totalDelay = 0;

    payments.forEach(payment => {
      totalPaid += Number(payment.amount);

      if (payment.processedAt && payment.createdAt) {
        const delayDays = Math.floor(
          (new Date(payment.processedAt) - new Date(payment.createdAt)) / (1000 * 60 * 60 * 24)
        );

        if (delayDays <= 7) {
          onTimePayments++;
        } else {
          latePayments++;
          totalDelay += delayDays;
        }
      }
    });

    return {
      totalPayments: payments.length,
      totalPaid: totalPaid.toFixed(2),
      averagePaymentAmount: (totalPaid / payments.length).toFixed(2),
      onTimePayments,
      latePayments,
      onTimePaymentRate: ((onTimePayments / payments.length) * 100).toFixed(2),
      averagePaymentDelay: latePayments > 0 ? (totalDelay / latePayments).toFixed(2) : 0,
    };
  }

  _calculateReliabilityRating(creditScore, riskScore, paymentMetrics) {
    // Calculate reliability on 1-5 scale
    // Higher credit score = better
    // Lower risk score = better
    // Higher on-time payment rate = better

    const creditWeight = 0.4;
    const riskWeight = 0.3;
    const paymentWeight = 0.3;

    const creditComponent = (creditScore / 900) * 5;
    const riskComponent = ((100 - riskScore) / 100) * 5;
    const paymentComponent = (parseFloat(paymentMetrics.onTimePaymentRate || 0) / 100) * 5;

    const rating = (
      creditComponent * creditWeight +
      riskComponent * riskWeight +
      paymentComponent * paymentWeight
    );

    return {
      rating: rating.toFixed(2),
      grade: this._getReliabilityGrade(rating),
      components: {
        creditScore: creditComponent.toFixed(2),
        riskScore: riskComponent.toFixed(2),
        paymentDiscipline: paymentComponent.toFixed(2),
      },
    };
  }

  _getCreditGrade(score) {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 550) return 'Fair';
    if (score >= 450) return 'Poor';
    return 'Very Poor';
  }

  _getReliabilityGrade(rating) {
    if (rating >= 4.5) return 'A+ (Excellent)';
    if (rating >= 4.0) return 'A (Very Good)';
    if (rating >= 3.5) return 'B+ (Good)';
    if (rating >= 3.0) return 'B (Satisfactory)';
    if (rating >= 2.5) return 'C+ (Fair)';
    if (rating >= 2.0) return 'C (Below Average)';
    if (rating >= 1.5) return 'D (Poor)';
    return 'F (Very Poor)';
  }

  _groupOrdersByStatus(orders) {
    const grouped = {};
    orders.forEach(order => {
      grouped[order.status] = (grouped[order.status] || 0) + 1;
    });
    return grouped;
  }

  _calculateProductBreakdown(orders) {
    const products = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const productName = item.product.name;
        if (!products[productName]) {
          products[productName] = {
            quantity: 0,
            totalValue: 0,
          };
        }
        products[productName].quantity += item.quantity;
        products[productName].totalValue += Number(item.total);
      });
    });

    return Object.entries(products).map(([name, data]) => ({
      productName: name,
      quantity: data.quantity,
      totalValue: data.totalValue.toFixed(2),
    }));
  }

  _analyzePaymentDiscipline(orders, payments) {
    const totalOrders = orders.length;
    if (totalOrders === 0) {
      return {
        disciplineScore: 0,
        totalOrders: 0,
        paidOnTime: 0,
        paidLate: 0,
        unpaid: 0,
        averagePaymentDelay: 0,
      };
    }

    let paidOnTime = 0;
    let paidLate = 0;
    let unpaid = 0;
    let totalDelay = 0;
    let delayCount = 0;

    orders.forEach(order => {
      if (order.paymentStatus === 'PAID') {
        const orderPayments = payments.filter(p => p.orderId === order.id);
        if (orderPayments.length > 0) {
          const lastPayment = orderPayments[orderPayments.length - 1];
          const expectedDate = order.deliveredAt || order.confirmedAt || order.createdAt;
          
          if (lastPayment.processedAt && expectedDate) {
            const delayDays = Math.floor(
              (new Date(lastPayment.processedAt) - new Date(expectedDate)) / (1000 * 60 * 60 * 24)
            );

            if (delayDays <= 7) {
              paidOnTime++;
            } else {
              paidLate++;
              totalDelay += delayDays;
              delayCount++;
            }
          }
        }
      } else if (['PENDING', 'PARTIAL', 'OVERDUE'].includes(order.paymentStatus)) {
        unpaid++;
      }
    });

    const disciplineScore = ((paidOnTime / totalOrders) * 100).toFixed(2);

    return {
      disciplineScore: parseFloat(disciplineScore),
      totalOrders,
      paidOnTime,
      paidLate,
      unpaid,
      averagePaymentDelay: delayCount > 0 ? (totalDelay / delayCount).toFixed(2) : 0,
      onTimePaymentRate: ((paidOnTime / totalOrders) * 100).toFixed(2),
    };
  }

  _calculateLiabilityBreakdown(orders) {
    const breakdown = {
      current: 0,      // 0-30 days
      days30to60: 0,   // 31-60 days
      days60to90: 0,   // 61-90 days
      over90days: 0,   // 90+ days
    };

    const now = new Date();

    orders.forEach(order => {
      const dueAmount = Number(order.dueAmount);
      if (dueAmount <= 0) return;

      const orderDate = new Date(order.deliveredAt || order.createdAt);
      const daysPast = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));

      if (daysPast <= 30) {
        breakdown.current += dueAmount;
      } else if (daysPast <= 60) {
        breakdown.days30to60 += dueAmount;
      } else if (daysPast <= 90) {
        breakdown.days60to90 += dueAmount;
      } else {
        breakdown.over90days += dueAmount;
      }
    });

    return {
      current: breakdown.current.toFixed(2),
      days30to60: breakdown.days30to60.toFixed(2),
      days60to90: breakdown.days60to90.toFixed(2),
      over90days: breakdown.over90days.toFixed(2),
    };
  }

  _calculateAgingAnalysis(orders) {
    const aging = [];

    orders.forEach(order => {
      const dueAmount = Number(order.dueAmount);
      if (dueAmount <= 0) return;

      const orderDate = new Date(order.deliveredAt || order.createdAt);
      const daysPast = Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));

      aging.push({
        orderNumber: order.orderNumber,
        orderDate: orderDate.toISOString().split('T')[0],
        dueAmount: dueAmount.toFixed(2),
        daysPastDue: daysPast,
        status: order.paymentStatus,
      });
    });

    return aging.sort((a, b) => b.daysPastDue - a.daysPastDue);
  }

  _getCSVHeaders(reportType) {
    const commonHeaders = [
      'Retailer ID',
      'Retailer Code',
      'Business Name',
      'Shop Name',
      'Phone Number',
      'Credit Limit',
      'Credit Score',
      'Credit Grade',
      'Reliability Rating',
      'Reliability Grade',
    ];

    switch (reportType) {
      case 'credit_summary':
        return [
          ...commonHeaders,
          'Available Credit',
          'Outstanding Debt',
          'Credit Utilization %',
          'Risk Score',
          'Risk Level',
          'Days Overdue',
          'Total Payments',
          'On-Time Payment Rate %',
        ];
      
      case 'purchase_volume':
        return [
          ...commonHeaders,
          'Period',
          'Total Orders',
          'Total Purchase Value',
          'Average Order Value',
          'Credit Used',
        ];
      
      case 'payment_discipline':
        return [
          ...commonHeaders,
          'Discipline Score',
          'Total Orders',
          'Paid On Time',
          'Paid Late',
          'Unpaid',
          'Avg Payment Delay (days)',
        ];
      
      case 'outstanding_liability':
        return [
          ...commonHeaders,
          'Total Outstanding',
          'Current (0-30 days)',
          '31-60 days',
          '61-90 days',
          'Over 90 days',
          'Risk Level',
        ];
      
      default:
        return commonHeaders;
    }
  }

  _formatCSVRow(item, reportType) {
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const common = [
      escape(item.retailerDetails.retailerId),
      escape(item.retailerDetails.retailerCode),
      escape(item.retailerDetails.businessName),
      escape(item.retailerDetails.shopName),
      escape(item.retailerDetails.phoneNumber),
      escape(item.creditInformation?.creditLimit || item.creditScore?.score || ''),
      escape(item.creditScore?.score || ''),
      escape(item.creditScore?.grade || ''),
      escape(item.reliabilityRating?.rating || ''),
      escape(item.reliabilityRating?.grade || ''),
    ];

    switch (reportType) {
      case 'credit_summary':
        return [
          ...common,
          escape(item.creditInformation.availableCredit),
          escape(item.creditInformation.outstandingDebt),
          escape(item.creditInformation.creditUtilization),
          escape(item.riskAssessment.riskScore),
          escape(item.riskAssessment.riskLevel),
          escape(item.riskAssessment.daysOverdue),
          escape(item.paymentHistory.totalPayments),
          escape(item.paymentHistory.onTimePaymentRate),
        ].join(',');
      
      case 'purchase_volume':
        return [
          ...common,
          escape(`${item.periodInformation.month} ${item.periodInformation.year}`),
          escape(item.purchaseMetrics.totalOrders),
          escape(item.purchaseMetrics.totalPurchaseValue),
          escape(item.purchaseMetrics.averageOrderValue),
          escape(item.creditInformation.creditUsedThisMonth),
        ].join(',');
      
      case 'payment_discipline':
        return [
          ...common,
          escape(item.paymentDiscipline.disciplineScore),
          escape(item.paymentDiscipline.totalOrders),
          escape(item.paymentDiscipline.paidOnTime),
          escape(item.paymentDiscipline.paidLate),
          escape(item.paymentDiscipline.unpaid),
          escape(item.paymentDiscipline.averagePaymentDelay),
        ].join(',');
      
      case 'outstanding_liability':
        return [
          ...common,
          escape(item.liabilitySummary.totalOutstanding),
          escape(item.liabilityBreakdown.current),
          escape(item.liabilityBreakdown.days30to60),
          escape(item.liabilityBreakdown.days60to90),
          escape(item.liabilityBreakdown.over90days),
          escape(item.riskAssessment.riskLevel),
        ].join(',');
      
      default:
        return common.join(',');
    }
  }
}

module.exports = new FinancialExportService();
