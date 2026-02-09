const riskControlService = require('../services/riskControl.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Get all risk configurations
 */
exports.getRiskConfigs = async (req, res) => {
  try {
    const configs = await riskControlService.getAllRiskConfigs();
    return successResponse(res, configs, 'Risk configurations retrieved');
  } catch (error) {
    logger.error('Get risk configs error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Update risk configuration
 */
exports.updateRiskConfig = async (req, res) => {
  try {
    const { configKey } = req.params;
    const { configValue } = req.body;

    if (!configValue) {
      return errorResponse(res, 'Config value is required', 400);
    }

    const config = await riskControlService.updateRiskConfig(
      configKey,
      configValue,
      req.user.id
    );

    return successResponse(res, config, 'Risk configuration updated');
  } catch (error) {
    logger.error('Update risk config error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Calculate retailer risk score
 */
exports.calculateRiskScore = async (req, res) => {
  try {
    const { retailerId } = req.params;

    const riskScore = await riskControlService.calculateRetailerRiskScore(retailerId);

    return successResponse(res, riskScore, 'Risk score calculated');
  } catch (error) {
    logger.error('Calculate risk score error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Apply automated risk controls
 */
exports.applyAutomatedControls = async (req, res) => {
  try {
    const { retailerId } = req.params;

    const result = await riskControlService.applyAutomatedControls(retailerId);

    return successResponse(res, result, 'Automated controls applied');
  } catch (error) {
    logger.error('Apply automated controls error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get risk alerts
 */
exports.getRiskAlerts = async (req, res) => {
  try {
    const { severity, alertType, retailerId, isAcknowledged, limit } = req.query;

    const filters = {
      severity,
      alertType,
      retailerId,
      isAcknowledged: isAcknowledged === 'true' ? true : isAcknowledged === 'false' ? false : undefined,
      limit: limit ? parseInt(limit) : 50,
    };

    const alerts = await riskControlService.getRiskAlerts(filters);

    return successResponse(res, alerts, 'Risk alerts retrieved');
  } catch (error) {
    logger.error('Get risk alerts error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Acknowledge risk alert
 */
exports.acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    const alert = await riskControlService.acknowledgeAlert(alertId, req.user.id);

    return successResponse(res, alert, 'Alert acknowledged');
  } catch (error) {
    logger.error('Acknowledge alert error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get risk actions history
 */
exports.getRiskActions = async (req, res) => {
  try {
    const { retailerId } = req.params;
    const { limit } = req.query;

    const actions = await riskControlService.getRiskActions(
      retailerId,
      limit ? parseInt(limit) : 50
    );

    return successResponse(res, actions, 'Risk actions retrieved');
  } catch (error) {
    logger.error('Get risk actions error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get retailer risk score
 */
exports.getRetailerRiskScore = async (req, res) => {
  try {
    const { retailerId } = req.params;

    const riskScore = await riskControlService.getRetailerRiskScore(retailerId);

    if (!riskScore) {
      return errorResponse(res, 'Risk score not found', 404);
    }

    return successResponse(res, riskScore, 'Risk score retrieved');
  } catch (error) {
    logger.error('Get retailer risk score error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Get risk dashboard summary
 */
exports.getRiskDashboard = async (req, res) => {
  try {
    const [
      criticalAlerts,
      highRiskRetailers,
      recentActions,
      configs,
    ] = await Promise.all([
      riskControlService.getRiskAlerts({ severity: 'CRITICAL', isAcknowledged: false, limit: 10 }),
      prisma.retailerRiskScore.findMany({
        where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
        orderBy: { riskScore: 'desc' },
        take: 20,
      }),
      riskControlService.getRiskActions(null, 20),
      riskControlService.getAllRiskConfigs(),
    ]);

    const summary = {
      criticalAlertsCount: criticalAlerts.length,
      highRiskRetailersCount: highRiskRetailers.length,
      recentActionsCount: recentActions.length,
      criticalAlerts,
      highRiskRetailers,
      recentActions: recentActions.slice(0, 10),
      configs,
    };

    return successResponse(res, summary, 'Risk dashboard retrieved');
  } catch (error) {
    logger.error('Get risk dashboard error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};
