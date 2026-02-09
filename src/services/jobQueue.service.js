const { queueManager, QUEUES } = require('../queues/queueManager');
const logger = require('../utils/logger');

class JobQueueService {
  /**
   * Send WhatsApp message
   */
  async sendWhatsAppMessage(messageType, recipient, data, options = {}) {
    return await queueManager.addJob(
      'WHATSAPP',
      `whatsapp-${messageType.toLowerCase()}`,
      {
        messageType,
        recipient,
        data,
      },
      {
        ...options,
        deduplicate: true,
        deduplicationKey: options.deduplicationKey || `whatsapp-${messageType}-${recipient}-${Date.now()}`,
      }
    );
  }

  /**
   * Calculate credit score
   */
  async calculateCreditScore(retailerId, reason, options = {}) {
    return await queueManager.addJob(
      'CREDIT_SCORE',
      'credit-score-calculation',
      {
        retailerId,
        reason,
      },
      {
        ...options,
        deduplicate: true,
        deduplicationKey: `credit-score-${retailerId}`,
        delay: options.delay || 5000, // Default 5 second delay
      }
    );
  }

  /**
   * Route order to vendor
   */
  async routeOrder(orderId, orderData, options = {}) {
    return await queueManager.addJob(
      'ORDER_ROUTING',
      'order-routing',
      {
        orderId,
        orderData,
        attempt: options.attempt || 1,
        previousVendorId: options.previousVendorId,
      },
      {
        ...options,
        deduplicate: true,
        deduplicationKey: `order-routing-${orderId}-${options.attempt || 1}`,
      }
    );
  }

  /**
   * Retry order routing (fallback)
   */
  async retryOrderRouting(orderId, previousVendorId, attempt = 2) {
    return await this.routeOrder(orderId, null, {
      attempt,
      previousVendorId,
      delay: 60000, // 1 minute delay
    });
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(retailerId, orderId = null, reminderType = 'OVERDUE', options = {}) {
    return await queueManager.addJob(
      'PAYMENT_REMINDERS',
      'payment-reminder',
      {
        retailerId,
        orderId,
        reminderType,
      },
      {
        ...options,
        deduplicate: true,
        deduplicationKey: orderId 
          ? `payment-reminder-${orderId}` 
          : `payment-reminder-${retailerId}-${Date.now()}`,
      }
    );
  }

  /**
   * Schedule payment reminders for all overdue orders
   */
  async schedulePaymentReminders(retailerIds, reminderType = 'OVERDUE') {
    const jobs = [];

    for (const retailerId of retailerIds) {
      const job = await this.sendPaymentReminder(retailerId, null, reminderType, {
        delay: Math.random() * 60000, // Random delay up to 1 minute to spread load
      });
      jobs.push(job);
    }

    logger.info(`Scheduled ${jobs.length} payment reminder jobs`);
    return jobs;
  }

  /**
   * Generate report
   */
  async generateReport(reportType, format, filters, userId, email = null, options = {}) {
    return await queueManager.addJob(
      'REPORT_GENERATION',
      `report-${reportType.toLowerCase()}`,
      {
        reportType,
        format,
        filters,
        userId,
        email,
      },
      {
        ...options,
        attempts: 2, // Reports are expensive, limit retries
        timeout: 300000, // 5 minute timeout
      }
    );
  }

  /**
   * Process order action
   */
  async processOrder(orderId, action, data = {}, options = {}) {
    return await queueManager.addJob(
      'ORDER_PROCESSING',
      `order-${action.toLowerCase()}`,
      {
        orderId,
        action,
        data,
      },
      {
        ...options,
        deduplicate: true,
        deduplicationKey: `order-${action}-${orderId}`,
      }
    );
  }

  /**
   * Confirm order (with all notifications)
   */
  async confirmOrder(orderId) {
    return await this.processOrder(orderId, 'CONFIRM');
  }

  /**
   * Assign vendor to order
   */
  async assignVendorToOrder(orderId, vendorId) {
    return await this.processOrder(orderId, 'ASSIGN_VENDOR', { vendorId });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId, newStatus, notes = null) {
    return await this.processOrder(orderId, 'UPDATE_STATUS', { newStatus, notes });
  }

  /**
   * Complete order
   */
  async completeOrder(orderId) {
    return await this.processOrder(orderId, 'COMPLETE');
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId, reason) {
    return await this.processOrder(orderId, 'CANCEL', { reason });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return await queueManager.getAllQueueStats();
  }

  /**
   * Get failed jobs for a queue
   */
  async getFailedJobs(queueKey, start = 0, end = 10) {
    return await queueManager.getFailedJobs(queueKey, start, end);
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(queueKey, jobId) {
    return await queueManager.retryJob(queueKey, jobId);
  }

  /**
   * Clean old jobs
   */
  async cleanOldJobs(queueKey, gracePeriodHours = 24) {
    const grace = gracePeriodHours * 3600 * 1000;
    await queueManager.cleanQueue(queueKey, grace, 'completed');
    await queueManager.cleanQueue(queueKey, grace * 7, 'failed'); // Keep failed jobs longer
  }
}

module.exports = new JobQueueService();
