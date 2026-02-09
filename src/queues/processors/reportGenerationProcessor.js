const financialExportService = require('../../services/financialExport.service');
const logger = require('../../utils/logger');
const monitoringService = require('../../services/monitoring.service');
const fs = require('fs').promises;
const path = require('path');

/**
 * Report Generation Processor
 * Handles generating reports asynchronously
 */
async function reportGenerationProcessor(job) {
  const { reportType, format, filters, userId, email } = job.data;

  logger.info(`Processing report generation job ${job.id}`, {
    reportType,
    format,
    filters,
  });

  try {
    let reportData;
    let filename;

    // Generate report based on type
    switch (reportType) {
      case 'CREDIT_SUMMARY':
        reportData = await financialExportService.generateCreditSummaryReport(filters);
        filename = `credit-summary-${Date.now()}.${format}`;
        break;

      case 'PURCHASE_VOLUME':
        reportData = await financialExportService.generatePurchaseVolumeReport(filters);
        filename = `purchase-volume-${Date.now()}.${format}`;
        break;

      case 'PAYMENT_DISCIPLINE':
        reportData = await financialExportService.generatePaymentDisciplineReport(filters);
        filename = `payment-discipline-${Date.now()}.${format}`;
        break;

      case 'OUTSTANDING_LIABILITY':
        reportData = await financialExportService.generateOutstandingLiabilityReport(filters);
        filename = `outstanding-liability-${Date.now()}.${format}`;
        break;

      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }

    // Format report data
    let formattedData;
    switch (format) {
      case 'json':
        formattedData = JSON.stringify(reportData, null, 2);
        break;

      case 'csv':
        formattedData = await financialExportService.formatAsCSV(reportData);
        break;

      case 'pdf':
        formattedData = await financialExportService.formatAsPDF(reportData);
        break;

      default:
        throw new Error(`Unknown format: ${format}`);
    }

    // Save report to file system (optional)
    const reportsDir = path.join(__dirname, '../../reports');
    await fs.mkdir(reportsDir, { recursive: true });
    const filepath = path.join(reportsDir, filename);
    await fs.writeFile(filepath, formattedData);

    // TODO: Send email with report attachment if email provided
    // if (email) {
    //   await emailService.sendReportEmail(email, filename, filepath);
    // }

    logger.info(`Report generation job ${job.id} completed`, {
      reportType,
      format,
      filename,
      filepath,
    });

    // Track job completion
    try {
      await monitoringService.trackJobCompleted('report-generation', job.id, true);
    } catch (error) {
      console.error('Failed to track job completion:', error.message);
    }

    return {
      success: true,
      reportType,
      format,
      filename,
      filepath,
      recordCount: Array.isArray(reportData) ? reportData.length : 1,
    };
  } catch (error) {
    logger.error(`Report generation job ${job.id} failed`, {
      error: error.message,
      reportType,
      format,
    });

    // Track job failure
    try {
      await monitoringService.trackJobCompleted('report-generation', job.id, false, error.message);
    } catch (monitorError) {
      console.error('Failed to track job failure:', monitorError.message);
    }

    throw error; // Will trigger retry
  }
}

module.exports = reportGenerationProcessor;
