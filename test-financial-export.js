/**
 * Test script for Financial Export System
 * Run with: node test-financial-export.js
 */

const financialExportService = require('./src/services/financialExport.service');
const prisma = require('./src/config/database');

async function testFinancialExport() {
  console.log('🧪 Testing Financial Export System...\n');

  try {
    // 1. Test: Get a retailer
    console.log('1️⃣ Finding Test Retailer...');
    const retailer = await prisma.retailer.findFirst({
      where: { deletedAt: null },
    });
    
    if (!retailer) {
      console.log('❌ No retailer found. Please seed the database first.');
      return;
    }
    console.log(`✅ Found retailer: ${retailer.retailerCode}`);
    console.log('');

    // 2. Test: Generate Credit Summary
    console.log('2️⃣ Testing: Credit Summary Report');
    const creditSummary = await financialExportService.generateRetailerCreditSummary({
      retailerId: retailer.id,
    });
    console.log(`✅ Generated credit summary for ${creditSummary.length} retailer(s)`);
    if (creditSummary.length > 0) {
      const report = creditSummary[0];
      console.log(`   - Credit Score: ${report.creditScore.score} (${report.creditScore.grade})`);
      console.log(`   - Credit Limit: ${report.creditInformation.creditLimit}`);
      console.log(`   - Outstanding: ${report.creditInformation.outstandingDebt}`);
      console.log(`   - Reliability: ${report.reliabilityRating.rating} (${report.reliabilityRating.grade})`);
    }
    console.log('');

    // 3. Test: Generate Purchase Volume
    console.log('3️⃣ Testing: Purchase Volume Report');
    const purchaseVolume = await financialExportService.generateMonthlyPurchaseVolume({
      retailerId: retailer.id,
    });
    console.log(`✅ Generated purchase volume for ${purchaseVolume.length} retailer(s)`);
    if (purchaseVolume.length > 0) {
      const report = purchaseVolume[0];
      console.log(`   - Period: ${report.periodInformation.month} ${report.periodInformation.year}`);
      console.log(`   - Total Orders: ${report.purchaseMetrics.totalOrders}`);
      console.log(`   - Total Value: ${report.purchaseMetrics.totalPurchaseValue}`);
      console.log(`   - Avg Order: ${report.purchaseMetrics.averageOrderValue}`);
    }
    console.log('');

    // 4. Test: Generate Payment Discipline
    console.log('4️⃣ Testing: Payment Discipline Report');
    const paymentDiscipline = await financialExportService.generatePaymentDisciplineReport({
      retailerId: retailer.id,
    });
    console.log(`✅ Generated payment discipline for ${paymentDiscipline.length} retailer(s)`);
    if (paymentDiscipline.length > 0) {
      const report = paymentDiscipline[0];
      console.log(`   - Discipline Score: ${report.paymentDiscipline.disciplineScore}`);
      console.log(`   - On-Time Payments: ${report.paymentDiscipline.paidOnTime}`);
      console.log(`   - Late Payments: ${report.paymentDiscipline.paidLate}`);
      console.log(`   - On-Time Rate: ${report.paymentDiscipline.onTimePaymentRate}%`);
    }
    console.log('');

    // 5. Test: Generate Outstanding Liability
    console.log('5️⃣ Testing: Outstanding Liability Report');
    const outstandingLiability = await financialExportService.generateOutstandingLiabilityReport({
      retailerId: retailer.id,
    });
    console.log(`✅ Generated liability report for ${outstandingLiability.length} retailer(s)`);
    if (outstandingLiability.length > 0) {
      const report = outstandingLiability[0];
      console.log(`   - Total Outstanding: ${report.liabilitySummary.totalOutstanding}`);
      console.log(`   - Current (0-30): ${report.liabilityBreakdown.current}`);
      console.log(`   - 31-60 days: ${report.liabilityBreakdown.days30to60}`);
      console.log(`   - Risk Level: ${report.riskAssessment.riskLevel}`);
    }
    console.log('');

    // 6. Test: CSV Export
    console.log('6️⃣ Testing: CSV Export');
    const csv = financialExportService.exportToCSV(creditSummary, 'credit_summary');
    const csvLines = csv.split('\n');
    console.log(`✅ Generated CSV with ${csvLines.length} lines`);
    console.log(`   - Header: ${csvLines[0].substring(0, 80)}...`);
    console.log('');

    // 7. Test: PDF-ready JSON Export
    console.log('7️⃣ Testing: PDF-ready JSON Export');
    const pdfJson = financialExportService.exportToPDFJSON(creditSummary, 'Credit Summary');
    console.log(`✅ Generated PDF-ready JSON`);
    console.log(`   - Report Type: ${pdfJson.reportType}`);
    console.log(`   - Total Records: ${pdfJson.totalRecords}`);
    console.log(`   - Format: ${pdfJson.metadata.format}`);
    console.log('');

    console.log('🎉 All tests passed successfully!\n');
    console.log('📊 Financial Export System is working correctly.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Generate reports: GET /api/v1/financial-export/credit-summary');
    console.log('3. Export as CSV: GET /api/v1/financial-export/credit-summary?format=csv');
    console.log('4. Export as PDF JSON: GET /api/v1/financial-export/combined?format=pdf-json');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testFinancialExport();
