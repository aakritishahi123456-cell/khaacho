const prisma = require('../config/database');
const logger = require('../utils/logger');

class DashboardService {
  async getAdminDashboard(dateRange = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    const [
      orderStats,
      revenueStats,
      topRetailers,
      topVendors,
      ordersByStatus,
      recentOrders,
      creditRisk,
    ] = await Promise.all([
      this.getOrderStats(startDate),
      this.getRevenueStats(startDate),
      this.getTopRetailers(10),
      this.getTopVendors(10),
      this.getOrdersByStatus(),
      this.getRecentOrders(20),
      this.getCreditRiskSummary(),
    ]);

    return {
      orderStats,
      revenueStats,
      topRetailers,
      topVendors,
      ordersByStatus,
      recentOrders,
      creditRisk,
      generatedAt: new Date(),
    };
  }

  async getOrderStats(startDate) {
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        status: true,
        total: true,
        createdAt: true,
      },
    });

    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED').length;
    const pendingOrders = orders.filter(o => 
      ['DRAFT', 'CONFIRMED', 'VENDOR_ASSIGNED', 'ACCEPTED', 'DISPATCHED', 'DELIVERED'].includes(o.status)
    ).length;

    const totalValue = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const avgOrderValue = totalOrders > 0 ? totalValue / totalOrders : 0;

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      totalValue,
      avgOrderValue,
      completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
      cancellationRate: totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0,
    };
  }

  async getRevenueStats(startDate) {
    const result = await prisma.order.aggregate({
      where: {
        createdAt: { gte: startDate },
        status: { in: ['DELIVERED', 'COMPLETED'] },
      },
      _sum: {
        total: true,
        paidAmount: true,
      },
    });

    const totalRevenue = parseFloat(result._sum.total || 0);
    const collectedRevenue = parseFloat(result._sum.paidAmount || 0);
    const outstandingRevenue = totalRevenue - collectedRevenue;

    return {
      totalRevenue,
      collectedRevenue,
      outstandingRevenue,
      collectionRate: totalRevenue > 0 ? (collectedRevenue / totalRevenue) * 100 : 0,
    };
  }

  async getTopRetailers(limit = 10) {
    return await prisma.retailer.findMany({
      take: limit,
      orderBy: { totalSpent: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            businessName: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  async getTopVendors(limit = 10) {
    return await prisma.vendor.findMany({
      take: limit,
      orderBy: { totalSales: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            businessName: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  async getOrdersByStatus() {
    const result = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
    });

    return result.map(item => ({
      status: item.status,
      count: item._count.id,
      totalValue: parseFloat(item._sum.total || 0),
    }));
  }

  async getRecentOrders(limit = 20) {
    return await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        retailer: {
          include: {
            user: {
              select: {
                name: true,
                businessName: true,
              },
            },
          },
        },
        vendor: {
          include: {
            user: {
              select: {
                name: true,
                businessName: true,
              },
            },
          },
        },
      },
    });
  }

  async getCreditRiskSummary() {
    const retailers = await prisma.retailer.findMany({
      where: {
        outstandingDebt: { gt: 0 },
      },
      select: {
        id: true,
        retailerCode: true,
        shopName: true,
        creditScore: true,
        outstandingDebt: true,
        creditLimit: true,
      },
    });

    const highRisk = retailers.filter(r => r.creditScore < 500);
    const mediumRisk = retailers.filter(r => r.creditScore >= 500 && r.creditScore < 700);
    const lowRisk = retailers.filter(r => r.creditScore >= 700);

    const totalOutstanding = retailers.reduce((sum, r) => sum + parseFloat(r.outstandingDebt), 0);

    return {
      totalRetailersWithDebt: retailers.length,
      totalOutstanding,
      highRisk: {
        count: highRisk.length,
        totalDebt: highRisk.reduce((sum, r) => sum + parseFloat(r.outstandingDebt), 0),
      },
      mediumRisk: {
        count: mediumRisk.length,
        totalDebt: mediumRisk.reduce((sum, r) => sum + parseFloat(r.outstandingDebt), 0),
      },
      lowRisk: {
        count: lowRisk.length,
        totalDebt: lowRisk.reduce((sum, r) => sum + parseFloat(r.outstandingDebt), 0),
      },
    };
  }

  async getVendorDashboard(vendorId) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [orders, products, revenue] = await Promise.all([
      prisma.order.findMany({
        where: {
          vendorId,
          createdAt: { gte: startDate },
        },
        include: {
          retailer: {
            include: {
              user: {
                select: { name: true, businessName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vendorProduct.count({
        where: { vendorId, isAvailable: true },
      }),
      prisma.order.aggregate({
        where: {
          vendorId,
          status: { in: ['DELIVERED', 'COMPLETED'] },
          createdAt: { gte: startDate },
        },
        _sum: { total: true },
      }),
    ]);

    const pendingOrders = orders.filter(o => 
      ['VENDOR_ASSIGNED', 'ACCEPTED', 'DISPATCHED'].includes(o.status)
    );

    return {
      totalOrders: orders.length,
      pendingOrders: pendingOrders.length,
      totalProducts: products,
      revenue: parseFloat(revenue._sum.total || 0),
      recentOrders: orders.slice(0, 10),
    };
  }

  async getRetailerDashboard(retailerId) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [retailer, orders, creditHistory] = await Promise.all([
      prisma.retailer.findUnique({
        where: { id: retailerId },
        include: {
          user: true,
        },
      }),
      prisma.order.findMany({
        where: {
          retailerId,
          createdAt: { gte: startDate },
        },
        include: {
          vendor: {
            include: {
              user: {
                select: { name: true, businessName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.creditLedger.findMany({
        where: { retailerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const activeOrders = orders.filter(o => 
      !['COMPLETED', 'CANCELLED'].includes(o.status)
    );

    return {
      retailer: {
        shopName: retailer.shopName,
        creditScore: retailer.creditScore,
        creditLimit: retailer.creditLimit,
        availableCredit: retailer.availableCredit,
        outstandingDebt: retailer.outstandingDebt,
        totalOrders: retailer.totalOrders,
        totalSpent: retailer.totalSpent,
      },
      recentOrders: orders.slice(0, 10),
      activeOrders,
      recentTransactions: creditHistory,
    };
  }
}

module.exports = new DashboardService();
