const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Alerting Service
 * Sends alerts for critical system failures
 */

// Alert cooldown to prevent spam (in milliseconds)
const ALERT_COOLDOWN = {
  critical: 5 * 60 * 1000, // 5 minutes
  high: 15 * 60 * 1000, // 15 minutes
  medium: 30 * 60 * 1000, // 30 minutes
  low: 60 * 60 * 1000, // 1 hour
};

// Track last alert time by type
const lastAlertTime = {};

/**
 * Send alert
 */
async function sendAlert(severity, title, details = {}) {
  try {
    // Check cooldown
    const alertKey = `${severity}:${title}`;
    const now = Date.now();
    const cooldown = ALERT_COOLDOWN[severity] || ALERT_COOLDOWN.medium;

    if (lastAlertTime[alertKey] && (now - lastAlertTime[alertKey]) < cooldown) {
      logger.debug('Alert suppressed due to cooldown', {
        severity,
        title,
        cooldownRemaining: Math.floor((cooldown - (now - lastAlertTime[alertKey])) / 1000) + 's',
      });
      return;
    }

    // Update last alert time
    lastAlertTime[alertKey] = now;

    // Log alert
    logger.warn('Alert triggered', {
      severity,
      title,
      details,
    });

    // Store alert in database
    await storeAlert(severity, title, details);

    // Send notifications based on severity
    if (severity === 'critical' || severity === 'high') {
      await sendNotifications(severity, title, details);
    }

    return true;
  } catch (error) {
    logger.error('Failed to send alert', {
      error: error.message,
      severity,
      title,
    });
    return false;
  }
}

/**
 * Store alert in database
 */
async function storeAlert(severity, title, details) {
  try {
    await prisma.$queryRaw`
      INSERT INTO system_alerts (
        severity,
        title,
        details,
        status,
        created_at
      ) VALUES (
        ${severity},
        ${title},
        ${JSON.stringify(details)}::jsonb,
        'active',
        CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    logger.error('Failed to store alert', {
      error: error.message,
    });
  }
}

/**
 * Send notifications (email, SMS, webhook, etc.)
 */
async function sendNotifications(severity, title, details) {
  try {
    // Get admin users to notify
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      },
    });

    // Format alert message
    const message = formatAlertMessage(severity, title, details);

    // Send to each admin
    for (const admin of admins) {
      // Email notification (if configured)
      if (process.env.ENABLE_EMAIL_ALERTS === 'true') {
        await sendEmailAlert(admin.email, title, message);
      }

      // SMS notification for critical alerts (if configured)
      if (severity === 'critical' && process.env.ENABLE_SMS_ALERTS === 'true') {
        await sendSMSAlert(admin.phoneNumber, title);
      }

      // In-app notification
      await createInAppNotification(admin.id, severity, title, message);
    }

    // Webhook notification (if configured)
    if (process.env.ALERT_WEBHOOK_URL) {
      await sendWebhookAlert(severity, title, details);
    }

    logger.info('Notifications sent', {
      severity,
      title,
      adminCount: admins.length,
    });
  } catch (error) {
    logger.error('Failed to send notifications', {
      error: error.message,
    });
  }
}

/**
 * Format alert message
 */
function formatAlertMessage(severity, title, details) {
  let message = `[${severity.toUpperCase()}] ${title}\n\n`;
  
  for (const [key, value] of Object.entries(details)) {
    message += `${key}: ${JSON.stringify(value)}\n`;
  }
  
  message += `\nTime: ${new Date().toISOString()}`;
  
  return message;
}

/**
 * Send email alert (placeholder - integrate with email service)
 */
async function sendEmailAlert(email, subject, message) {
  // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
  logger.info('Email alert would be sent', {
    to: email,
    subject,
  });
}

/**
 * Send SMS alert (placeholder - integrate with SMS service)
 */
async function sendSMSAlert(phoneNumber, message) {
  // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
  logger.info('SMS alert would be sent', {
    to: phoneNumber,
    message,
  });
}

/**
 * Create in-app notification
 */
async function createInAppNotification(userId, severity, title, message) {
  try {
    await prisma.$queryRaw`
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        severity,
        is_read,
        created_at
      ) VALUES (
        ${userId},
        'system_alert',
        ${title},
        ${message},
        ${severity},
        false,
        CURRENT_TIMESTAMP
      )
    `;
  } catch (error) {
    logger.error('Failed to create in-app notification', {
      error: error.message,
      userId,
    });
  }
}

/**
 * Send webhook alert
 */
async function sendWebhookAlert(severity, title, details) {
  try {
    const axios = require('axios');
    
    await axios.post(process.env.ALERT_WEBHOOK_URL, {
      severity,
      title,
      details,
      timestamp: new Date().toISOString(),
    }, {
      timeout: 5000,
    });

    logger.info('Webhook alert sent', {
      url: process.env.ALERT_WEBHOOK_URL,
    });
  } catch (error) {
    logger.error('Failed to send webhook alert', {
      error: error.message,
    });
  }
}

/**
 * Get active alerts
 */
async function getActiveAlerts(limit = 50) {
  try {
    const alerts = await prisma.$queryRaw`
      SELECT *
      FROM system_alerts
      WHERE status = 'active'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return alerts;
  } catch (error) {
    logger.error('Failed to get active alerts', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Acknowledge alert
 */
async function acknowledgeAlert(alertId, acknowledgedBy) {
  try {
    await prisma.$queryRaw`
      UPDATE system_alerts
      SET status = 'acknowledged',
          acknowledged_by = ${acknowledgedBy},
          acknowledged_at = CURRENT_TIMESTAMP
      WHERE id = ${alertId}
    `;

    logger.info('Alert acknowledged', {
      alertId,
      acknowledgedBy,
    });

    return true;
  } catch (error) {
    logger.error('Failed to acknowledge alert', {
      error: error.message,
      alertId,
    });
    return false;
  }
}

/**
 * Resolve alert
 */
async function resolveAlert(alertId, resolvedBy, resolution) {
  try {
    await prisma.$queryRaw`
      UPDATE system_alerts
      SET status = 'resolved',
          resolved_by = ${resolvedBy},
          resolved_at = CURRENT_TIMESTAMP,
          resolution = ${resolution}
      WHERE id = ${alertId}
    `;

    logger.info('Alert resolved', {
      alertId,
      resolvedBy,
    });

    return true;
  } catch (error) {
    logger.error('Failed to resolve alert', {
      error: error.message,
      alertId,
    });
    return false;
  }
}

/**
 * Get alert statistics
 */
async function getAlertStatistics(startDate, endDate) {
  try {
    const where = {};
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const stats = await prisma.$queryRaw`
      SELECT
        severity,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
      FROM system_alerts
      WHERE created_at >= ${startDate || '1970-01-01'}
        AND created_at <= ${endDate || '2099-12-31'}
      GROUP BY severity
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `;

    return stats;
  } catch (error) {
    logger.error('Failed to get alert statistics', {
      error: error.message,
    });
    return [];
  }
}

module.exports = {
  sendAlert,
  getActiveAlerts,
  acknowledgeAlert,
  resolveAlert,
  getAlertStatistics,
};
