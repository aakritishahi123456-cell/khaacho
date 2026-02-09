/**
 * Test script for Risk Control System
 * Run with: node test-risk-control.js
 */

const prisma = require('./src/config/database');
const riskControlService = require('./src/services/riskControl.service');

async function testRiskControl() {
  console.log('🧪 Testing Risk Control System...\n');

  try {
    // 1. Test: Get all risk configurations
    console.log('1️⃣ Testing: Get Risk Configurations');
    const configs = await riskControlService.getAllRiskConfigs();
    console.log(`✅ Found ${configs.length} risk configurations`);
    configs.forEach(c => console.log(`   - ${c.configKey}`));
    console.log('');

    // 2. Test: Get a retailer
    console.log('2️⃣ Testing: Find Test Retailer');
    const retailer = await prisma.retailer.findFirst({
      where: { deletedAt: null },
    });
    
    if (!retailer) {
      console.log('❌ No retailer found. Please seed the database first.');
      return;
    }
    console.log(`✅ Found retailer: ${retailer.id}`);
    console.log('');

    // 3. Test: Calculate risk score
    console.log('3️⃣ Testing: Calculate Risk Score');
    const riskScore = await riskControlService.calculateRetailerRiskScore(retailer.id);
    console.log(`✅ Risk Score Calculated:`);
    console.log(`   - Score: ${riskScore.riskScore}`);
    console.log(`   - Level: ${riskScore.riskLevel}`);
    console.log(`   - Payment Delay Score: ${riskScore.paymentDelayScore}`);
    console.log(`   - Credit Utilization Score: ${riskScore.creditUtilizationScore}`);
    console.log(`   - Order Pattern Score: ${riskScore.orderPatternScore}`);
    console.log(`   - Days Overdue: ${riskScore.daysOverdue}`);
    console.log('');

    // 4. Test: Apply automated controls
    console.log('4️⃣ Testing: Apply Automated Controls');
    const result = await riskControlService.applyAutomatedControls(retailer.id);
    console.log(`✅ Automated Controls Applied:`);
    console.log(`   - Actions Taken: ${result.actions.length}`);
    if (result.actions.length > 0) {
      result.actions.forEach(action => {
        console.log(`   - ${action.actionType}: ${action.reason}`);
      });
    } else {
      console.log(`   - No actions needed (risk level acceptable)`);
    }
    console.log('');

    // 5. Test: Get risk alerts
    console.log('5️⃣ Testing: Get Risk Alerts');
    const alerts = await riskControlService.getRiskAlerts({ limit: 5 });
    console.log(`✅ Found ${alerts.length} risk alerts`);
    alerts.forEach(alert => {
      console.log(`   - [${alert.severity}] ${alert.title}`);
    });
    console.log('');

    // 6. Test: Get risk actions
    console.log('6️⃣ Testing: Get Risk Actions');
    const actions = await riskControlService.getRiskActions(retailer.id, 5);
    console.log(`✅ Found ${actions.length} risk actions for retailer`);
    actions.forEach(action => {
      console.log(`   - ${action.actionType} (${action.triggeredBy})`);
    });
    console.log('');

    // 7. Test: Get specific config
    console.log('7️⃣ Testing: Get Specific Configuration');
    const paymentConfig = await riskControlService.getRiskConfig('payment_delay_threshold');
    console.log(`✅ Payment Delay Configuration:`);
    console.log(`   - Warning Days: ${paymentConfig.warning_days}`);
    console.log(`   - Critical Days: ${paymentConfig.critical_days}`);
    console.log(`   - Credit Reduction: ${paymentConfig.credit_reduction_percent}%`);
    console.log('');

    console.log('🎉 All tests passed successfully!\n');
    console.log('📊 Risk Control System is working correctly.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Access risk dashboard: GET /api/v1/risk-control/dashboard');
    console.log('3. Review risk alerts: GET /api/v1/risk-control/alerts');
    console.log('');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testRiskControl();
