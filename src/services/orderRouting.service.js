const prisma = require('../config/database');
const logger = require('../utils/logger');
const vendorPerformanceService = require('./vendorPerformance.service');
const priceIntelligenceService = require('./priceIntelligence.service');

class OrderRoutingService {
  /**
   * Route order to best vendor
   */
  async routeOrder(orderId, orderData, options = {}) {
    const { manualVendorId, overrideBy, overrideReason } = options;

    try {
      // Get routing configuration
      const config = await this.getRoutingConfig();

      // If manual override
      if (manualVendorId) {
        return await this._handleManualRouting(
          orderId,
          orderData,
          manualVendorId,
          overrideBy,
          overrideReason
        );
      }

      // Automatic routing
      return await this._handleAutomaticRouting(orderId, orderData, config);
    } catch (error) {
      logger.error('Order routing failed', { orderId, error: error.message });
      throw error;
    }
  }

  /**
   * Handle automatic vendor selection
   */
  async _handleAutomaticRouting(orderId, orderData, config) {
    const { retailerId, items } = orderData;

    // Get retailer location
    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
      include: { user: true },
    });

    // Find eligible vendors
    const eligibleVendors = await this._findEligibleVendors(items, config);

    if (eligibleVendors.length === 0) {
      throw new Error('No eligible vendors found for this order');
    }

    // Score and rank vendors
    const rankedVendors = await this._scoreAndRankVendors(
      eligibleVendors,
      retailer,
      items,
      config
    );

    // Select best vendor
    const selectedVendor = rankedVendors[0];
    const fallbackVendor = rankedVendors[1] || null;

    // Calculate acceptance deadline
    const acceptanceDeadline = new Date();
    acceptanceDeadline.setHours(
      acceptanceDeadline.getHours() + (config.acceptance_timeout?.hours || 2)
    );

    // Log routing decision
    const routingLog = await prisma.orderRoutingLog.create({
      data: {
        orderId,
        retailerId,
        routingAttempt: 1,
        vendorsEvaluated: rankedVendors.map(v => ({
          vendorId: v.vendorId,
          vendorCode: v.vendorCode,
          overallScore: v.overallScore,
          scores: v.scores,
          rank: v.rank,
        })),
        selectedVendorId: selectedVendor.vendorId,
        fallbackVendorId: fallbackVendor?.vendorId,
        routingReason: this._generateRoutingReason(selectedVendor, rankedVendors),
        routingCriteria: {
          weights: config.routing_weights,
          minReliability: config.min_reliability_score,
        },
        acceptanceDeadline,
        isManualOverride: false,
      },
    });

    // Create vendor acceptance record
    await prisma.vendorOrderAcceptance.create({
      data: {
        vendorId: selectedVendor.vendorId,
        orderId,
        routingLogId: routingLog.id,
        status: 'PENDING',
        notifiedAt: new Date(),
        responseDeadline: acceptanceDeadline,
      },
    });

    logger.info('Order routed automatically', {
      orderId,
      selectedVendor: selectedVendor.vendorCode,
      score: selectedVendor.overallScore,
      fallbackVendor: fallbackVendor?.vendorCode,
    });

    return {
      selectedVendor: selectedVendor.vendorId,
      fallbackVendor: fallbackVendor?.vendorId,
      routingLog,
      rankedVendors,
      acceptanceDeadline,
    };
  }

  /**
   * Handle manual vendor override
   */
  async _handleManualRouting(orderId, orderData, vendorId, overrideBy, overrideReason) {
    const { retailerId } = orderData;

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!vendor) {
      throw new Error('Selected vendor not found');
    }

    // Log manual routing
    const routingLog = await prisma.orderRoutingLog.create({
      data: {
        orderId,
        retailerId,
        routingAttempt: 1,
        selectedVendorId: vendorId,
        routingReason: overrideReason || 'Manual vendor selection by admin',
        isManualOverride: true,
        overrideBy,
        overrideReason,
      },
    });

    // Create acceptance record (auto-accepted for manual routing)
    await prisma.vendorOrderAcceptance.create({
      data: {
        vendorId,
        orderId,
        routingLogId: routingLog.id,
        status: 'ACCEPTED',
        notifiedAt: new Date(),
        respondedAt: new Date(),
        responseTimeMinutes: 0,
      },
    });

    logger.info('Order routed manually', {
      orderId,
      vendorId,
      overrideBy,
    });

    return {
      selectedVendor: vendorId,
      routingLog,
      isManualOverride: true,
    };
  }

  /**
   * Find eligible vendors for order items
   */
  async _findEligibleVendors(items, config) {
    const productIds = items.map(item => item.productId);

    // Get vendors who have all required products in stock
    const vendors = await prisma.vendor.findMany({
      where: {
        isApproved: true,
        deletedAt: null,
        user: {
          isActive: true,
        },
      },
      include: {
        user: true,
        vendorProducts: {
          where: {
            productId: { in: productIds },
            isAvailable: true,
            stock: { gt: 0 },
          },
          include: {
            product: true,
          },
        },
      },
    });

    // Filter vendors who have ALL required products
    const eligibleVendors = vendors.filter(vendor => {
      const availableProductIds = vendor.vendorProducts.map(vp => vp.productId);
      return productIds.every(pid => availableProductIds.includes(pid));
    });

    // Check minimum reliability if configured
    const minReliability = config.min_reliability_score?.score || 0;
    if (minReliability > 0) {
      return eligibleVendors.filter(v => Number(v.rating) >= minReliability);
    }

    return eligibleVendors;
  }

  /**
   * Score and rank vendors based on multiple criteria
   */
  async _scoreAndRankVendors(vendors, retailer, items, config) {
    const weights = config.routing_weights || {
      availability: 30,
      proximity: 20,
      workload: 15,
      price: 20,
      reliability: 15,
    };

    const scoredVendors = [];

    for (const vendor of vendors) {
      // Calculate individual scores
      const availabilityScore = this._calculateAvailabilityScore(vendor, items);
      const proximityScore = this._calculateProximityScore(vendor, retailer, config);
      const workloadScore = await this._calculateWorkloadScore(vendor.id, config);
      const priceScore = this._calculatePriceScore(vendor, items);
      const reliabilityScore = await this._calculateReliabilityScore(vendor);

      // Calculate weighted overall score
      const overallScore = (
        (availabilityScore * weights.availability / 100) +
        (proximityScore * weights.proximity / 100) +
        (workloadScore * weights.workload / 100) +
        (priceScore * weights.price / 100) +
        (reliabilityScore * weights.reliability / 100)
      );

      scoredVendors.push({
        vendorId: vendor.id,
        vendorCode: vendor.vendorCode,
        vendorName: vendor.user.businessName,
        scores: {
          availability: availabilityScore.toFixed(2),
          proximity: proximityScore.toFixed(2),
          workload: workloadScore.toFixed(2),
          price: priceScore.toFixed(2),
          reliability: reliabilityScore.toFixed(2),
        },
        overallScore: overallScore.toFixed(2),
        details: {
          location: {
            city: vendor.user.city,
            state: vendor.user.state,
          },
          rating: Number(vendor.rating),
          totalSales: Number(vendor.totalSales),
        },
      });
    }

    // Sort by overall score (descending)
    scoredVendors.sort((a, b) => parseFloat(b.overallScore) - parseFloat(a.overallScore));

    // Add rank
    scoredVendors.forEach((vendor, index) => {
      vendor.rank = index + 1;
    });

    return scoredVendors;
  }

  /**
   * Calculate availability score (0-100)
   */
  _calculateAvailabilityScore(vendor, items) {
    let totalScore = 0;
    let itemCount = 0;

    items.forEach(item => {
      const vendorProduct = vendor.vendorProducts.find(
        vp => vp.productId === item.productId
      );

      if (vendorProduct) {
        const requestedQty = item.quantity;
        const availableStock = vendorProduct.stock;

        if (availableStock >= requestedQty * 2) {
          // Plenty of stock
          totalScore += 100;
        } else if (availableStock >= requestedQty) {
          // Just enough stock
          totalScore += 70;
        } else {
          // Insufficient stock
          totalScore += 30;
        }
        itemCount++;
      }
    });

    return itemCount > 0 ? totalScore / itemCount : 0;
  }

  /**
   * Calculate proximity score (0-100)
   */
  _calculateProximityScore(vendor, retailer, config) {
    const proximityConfig = config.proximity_calculation || {
      same_city_bonus: 20,
      same_state_bonus: 10,
    };

    const vendorCity = vendor.user.city?.toLowerCase();
    const vendorState = vendor.user.state?.toLowerCase();
    const retailerCity = retailer.user.city?.toLowerCase();
    const retailerState = retailer.user.state?.toLowerCase();

    let score = 50; // Base score

    if (vendorCity && retailerCity && vendorCity === retailerCity) {
      score += proximityConfig.same_city_bonus;
    } else if (vendorState && retailerState && vendorState === retailerState) {
      score += proximityConfig.same_state_bonus;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate workload score (0-100)
   */
  async _calculateWorkloadScore(vendorId, config) {
    const thresholds = config.workload_thresholds || {
      low: 5,
      medium: 10,
      high: 20,
      max: 30,
    };

    // Count active orders
    const activeOrders = await prisma.order.count({
      where: {
        vendorId,
        status: { in: ['CONFIRMED', 'ACCEPTED', 'DISPATCHED'] },
      },
    });

    // Score based on workload
    if (activeOrders <= thresholds.low) return 100;
    if (activeOrders <= thresholds.medium) return 80;
    if (activeOrders <= thresholds.high) return 60;
    if (activeOrders <= thresholds.max) return 40;
    return 20; // Overloaded
  }

  /**
   * Calculate price score (0-100)
   */
  _calculatePriceScore(vendor, items) {
    const prices = [];

    items.forEach(item => {
      const vendorProduct = vendor.vendorProducts.find(
        vp => vp.productId === item.productId
      );
      if (vendorProduct) {
        prices.push(Number(vendorProduct.vendorPrice));
      }
    });

    if (prices.length === 0) return 50;

    // Calculate average price
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // Lower price = higher score (inverse relationship)
    // Normalize to 0-100 scale
    const maxPrice = Math.max(...prices) * 1.5;
    const score = ((maxPrice - avgPrice) / maxPrice) * 100;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate reliability score (0-100)
   * Now uses vendor performance metrics
   */
  async _calculateReliabilityScore(vendor) {
    try {
      // Try to get performance-based reliability score
      const performance = await vendorPerformanceService.getVendorPerformance(vendor.id);
      
      if (performance && performance.reliability_score) {
        return Number(performance.reliability_score);
      }
    } catch (error) {
      logger.warn('Could not fetch vendor performance, using fallback calculation', {
        vendorId: vendor.id,
        error: error.message,
      });
    }

    // Fallback to basic calculation if performance data not available
    const rating = Number(vendor.rating) || 0;
    const commissionRate = Number(vendor.commissionRate) || 0;

    // Convert 0-5 rating to 0-100 scale
    let score = (rating / 5) * 100;

    // Bonus for established vendors
    if (Number(vendor.totalSales) > 100000) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Generate human-readable routing reason
   */
  _generateRoutingReason(selectedVendor, allVendors) {
    const reasons = [];

    reasons.push(`Selected vendor: ${selectedVendor.vendorName} (${selectedVendor.vendorCode})`);
    reasons.push(`Overall score: ${selectedVendor.overallScore}/100`);
    reasons.push(`Rank: #${selectedVendor.rank} out of ${allVendors.length} eligible vendors`);

    // Highlight best scores
    const scores = selectedVendor.scores;
    const bestScores = Object.entries(scores)
      .sort((a, b) => parseFloat(b[1]) - parseFloat(a[1]))
      .slice(0, 2);

    reasons.push(`Top factors: ${bestScores.map(([k, v]) => `${k} (${v})`).join(', ')}`);

    return reasons.join('. ');
  }

  /**
   * Handle vendor acceptance response
   */
  async handleVendorResponse(acceptanceId, response, vendorId) {
    const acceptance = await prisma.vendorOrderAcceptance.findUnique({
      where: { id: acceptanceId },
      include: {
        order: true,
      },
    });

    if (!acceptance) {
      throw new Error('Acceptance record not found');
    }

    if (acceptance.status !== 'PENDING') {
      throw new Error('Order already responded to');
    }

    const now = new Date();
    const responseTime = Math.floor(
      (now - new Date(acceptance.notifiedAt)) / (1000 * 60)
    );

    if (response === 'ACCEPTED') {
      await prisma.vendorOrderAcceptance.update({
        where: { id: acceptanceId },
        data: {
          status: 'ACCEPTED',
          respondedAt: now,
          responseTimeMinutes: responseTime,
        },
      });

      await prisma.orderRoutingLog.update({
        where: { id: acceptance.routingLogId },
        data: {
          acceptedAt: now,
        },
      });

      logger.info('Vendor accepted order', {
        orderId: acceptance.orderId,
        vendorId,
        responseTime,
      });

      return { accepted: true };
    } else {
      // Rejected - trigger fallback
      await prisma.vendorOrderAcceptance.update({
        where: { id: acceptanceId },
        data: {
          status: 'REJECTED',
          respondedAt: now,
          responseTimeMinutes: responseTime,
          rejectionReason: response.reason || 'Vendor declined',
        },
      });

      await prisma.orderRoutingLog.update({
        where: { id: acceptance.routingLogId },
        data: {
          rejectedAt: now,
          rejectionReason: response.reason || 'Vendor declined',
        },
      });

      logger.warn('Vendor rejected order, triggering fallback', {
        orderId: acceptance.orderId,
        vendorId,
      });

      // Trigger fallback routing
      await this.handleFallbackRouting(acceptance.orderId);

      return { accepted: false, fallbackTriggered: true };
    }
  }

  /**
   * Handle fallback to next vendor
   */
  async handleFallbackRouting(orderId) {
    const routingLog = await prisma.orderRoutingLog.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });

    if (!routingLog || !routingLog.fallbackVendorId) {
      throw new Error('No fallback vendor available');
    }

    const acceptanceDeadline = new Date();
    acceptanceDeadline.setHours(acceptanceDeadline.getHours() + 2);

    // Create new routing log for fallback
    const newRoutingLog = await prisma.orderRoutingLog.create({
      data: {
        orderId,
        retailerId: routingLog.retailerId,
        routingAttempt: routingLog.routingAttempt + 1,
        selectedVendorId: routingLog.fallbackVendorId,
        routingReason: 'Fallback routing - primary vendor rejected order',
        acceptanceDeadline,
      },
    });

    // Create new acceptance record
    await prisma.vendorOrderAcceptance.create({
      data: {
        vendorId: routingLog.fallbackVendorId,
        orderId,
        routingLogId: newRoutingLog.id,
        status: 'PENDING',
        notifiedAt: new Date(),
        responseDeadline: acceptanceDeadline,
      },
    });

    logger.info('Fallback routing initiated', {
      orderId,
      fallbackVendor: routingLog.fallbackVendorId,
      attempt: routingLog.routingAttempt + 1,
    });

    return newRoutingLog;
  }

  /**
   * Check for expired acceptances and trigger fallback
   */
  async checkExpiredAcceptances() {
    const expiredAcceptances = await prisma.vendorOrderAcceptance.findMany({
      where: {
        status: 'PENDING',
        responseDeadline: { lt: new Date() },
      },
    });

    for (const acceptance of expiredAcceptances) {
      await prisma.vendorOrderAcceptance.update({
        where: { id: acceptance.id },
        data: { status: 'EXPIRED' },
      });

      logger.warn('Vendor acceptance expired, triggering fallback', {
        orderId: acceptance.orderId,
        vendorId: acceptance.vendorId,
      });

      try {
        await this.handleFallbackRouting(acceptance.orderId);
      } catch (error) {
        logger.error('Fallback routing failed', {
          orderId: acceptance.orderId,
          error: error.message,
        });
      }
    }

    return expiredAcceptances.length;
  }

  /**
   * Update vendor routing scores
   */
  async updateVendorRoutingScores(vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        user: true,
        orders: {
          where: {
            status: { in: ['CONFIRMED', 'ACCEPTED', 'DISPATCHED'] },
          },
        },
      },
    });

    if (!vendor) return;

    const activeOrdersCount = vendor.orders.length;
    const pendingOrdersCount = vendor.orders.filter(
      o => o.status === 'CONFIRMED'
    ).length;

    // Calculate average fulfillment time
    const completedOrders = await prisma.order.findMany({
      where: {
        vendorId,
        status: 'COMPLETED',
        deliveredAt: { not: null },
      },
      select: {
        createdAt: true,
        deliveredAt: true,
      },
      take: 50,
    });

    let avgFulfillmentTime = 0;
    if (completedOrders.length > 0) {
      const totalTime = completedOrders.reduce((sum, order) => {
        const hours = (new Date(order.deliveredAt) - new Date(order.createdAt)) / (1000 * 60 * 60);
        return sum + hours;
      }, 0);
      avgFulfillmentTime = Math.round(totalTime / completedOrders.length);
    }

    await prisma.vendorRoutingScore.upsert({
      where: { vendorId },
      update: {
        activeOrdersCount,
        pendingOrdersCount,
        averageFulfillmentTime,
        lastCalculatedAt: new Date(),
      },
      create: {
        vendorId,
        activeOrdersCount,
        pendingOrdersCount,
        averageFulfillmentTime,
      },
    });
  }

  /**
   * Get routing configuration
   */
  async getRoutingConfig() {
    const configs = await prisma.orderRoutingConfig.findMany({
      where: { isActive: true },
    });

    const configObj = {};
    configs.forEach(config => {
      configObj[config.configKey] = config.configValue;
    });

    return configObj;
  }

  /**
   * Get routing logs for an order
   */
  async getOrderRoutingLogs(orderId) {
    return prisma.orderRoutingLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get vendor acceptance status
   */
  async getVendorAcceptanceStatus(orderId) {
    return prisma.vendorOrderAcceptance.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = new OrderRoutingService();
