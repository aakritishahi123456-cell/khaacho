const financialExportService = require('../services/financialExport.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Generate Retailer Credit Summary Report
 */
exports.generateCreditSummary = async (req, res) => {
  try {
    const { retailerId, startDate, endDate, minCreditScore, maxCreditScore, format } = req.query;

    const filters = {
      retailerId,
      startDate,
      endDate,
      minCreditScore: minCreditScore ? parseInt(minCreditScore) : undefined,
      maxCreditScore: maxCreditScore ? parseInt(maxCreditScore) : undefined,
    };

    const data = await financialExportService.generateRetailerCreditSummary(filters);

    // Handle different export formats
    if (format === 'csv') {
      const csv = financialExportService.exportToCSV(data, 'credit_summary');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=credit_summary_${Date.now()}.csv`);
      return res.send(csv);
    }

    if (format === 'pdf-json') {
      const pdfJson = financialExportService.exportToPDFJSON(data, 'Retailer Credit Summary');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=credit_summary_${Date.now()}.json`);
      return res.json(pdfJson);
    }

    // Default JSON response
    return successResponse(res, data, 'Credit summary report generated');
  } catch (error) {
    logger.error('Generate credit summary error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Generate Monthly Purchase Volume Report
 */
exports.generatePurchaseVolume = async (req, res) => {
  try {
    const { retailerId, year, month, format } = req.query;

    const filters = {
      retailerId,
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
    };

    const data = await financialExportService.generateMonthlyPurchaseVolume(filters);

    if (format === 'csv') {
      const csv = financialExportService.exportToCSV(data, 'purchase_volume');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=purchase_volume_${Date.now()}.csv`);
      return res.send(csv);
    }

    if (format === 'pdf-json') {
      const pdfJson = financialExportService.exportToPDFJSON(data, 'Monthly Purchase Volume');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=purchase_volume_${Date.now()}.json`);
      return res.json(pdfJson);
    }

    return successResponse(res, data, 'Purchase volume report generated');
  } catch (error) {
    logger.error('Generate purchase volume error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Generate Payment Discipline Report
 */
exports.generatePaymentDiscipline = async (req, res) => {
  try {
    const { retailerId, startDate, endDate, minScore, maxScore, format } = req.query;

    const filters = {
      retailerId,
      startDate,
      endDate,
      minScore: minScore ? parseFloat(minScore) : undefined,
      maxScore: maxScore ? parseFloat(maxScore) : undefined,
    };

    const data = await financialExportService.generatePaymentDisciplineReport(filters);

    if (format === 'csv') {
      const csv = financialExportService.exportToCSV(data, 'payment_discipline');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=payment_discipline_${Date.now()}.csv`);
      return res.send(csv);
    }

    if (format === 'pdf-json') {
      const pdfJson = financialExportService.exportToPDFJSON(data, 'Payment Discipline Report');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=payment_discipline_${Date.now()}.json`);
      return res.json(pdfJson);
    }

    return successResponse(res, data, 'Payment discipline report generated');
  } catch (error) {
    logger.error('Generate payment discipline error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Generate Outstanding Liability Report
 */
exports.generateOutstandingLiability = async (req, res) => {
  try {
    const { retailerId, minAmount, maxAmount, overdueOnly, format } = req.query;

    const filters = {
      retailerId,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      overdueOnly: overdueOnly === 'true',
    };

    const data = await financialExportService.generateOutstandingLiabilityReport(filters);

    if (format === 'csv') {
      const csv = financialExportService.exportToCSV(data, 'outstanding_liability');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=outstanding_liability_${Date.now()}.csv`);
      return res.send(csv);
    }

    if (format === 'pdf-json') {
      const pdfJson = financialExportService.exportToPDFJSON(data, 'Outstanding Liability Report');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=outstanding_liability_${Date.now()}.json`);
      return res.json(pdfJson);
    }

    return successResponse(res, data, 'Outstanding liability report generated');
  } catch (error) {
    logger.error('Generate outstanding liability error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};

/**
 * Generate Combined Financial Report (All reports in one)
 */
exports.generateCombinedReport = async (req, res) => {
  try {
    const { retailerId, startDate, endDate, format } = req.query;

    const filters = { retailerId, startDate, endDate };

    const [creditSummary, purchaseVolume, paymentDiscipline, outstandingLiability] = await Promise.all([
      financialExportService.generateRetailerCreditSummary(filters),
      financialExportService.generateMonthlyPurchaseVolume(filters),
      financialExportService.generatePaymentDisciplineReport(filters),
      financialExportService.generateOutstandingLiabilityReport(filters),
    ]);

    const combinedData = {
      generatedAt: new Date().toISOString(),
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'Current',
      },
      reports: {
        creditSummary,
        purchaseVolume,
        paymentDiscipline,
        outstandingLiability,
      },
      summary: {
        totalRetailers: creditSummary.length,
        totalOutstanding: outstandingLiability.reduce((sum, r) => 
          sum + parseFloat(r.liabilitySummary.totalOutstanding), 0
        ).toFixed(2),
        averageCreditScore: creditSummary.length > 0
          ? (creditSummary.reduce((sum, r) => sum + r.creditScore.score, 0) / creditSummary.length).toFixed(0)
          : 0,
      },
    };

    if (format === 'pdf-json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=combined_financial_report_${Date.now()}.json`);
      return res.json(combinedData);
    }

    return successResponse(res, combinedData, 'Combined financial report generated');
  } catch (error) {
    logger.error('Generate combined report error', { error: error.message });
    return errorResponse(res, error.message, 500);
  }
};
