/**
 * Monitoring and Alerting System Test Script
 * 
 * Tests:
 * - System health check
 * - Metrics collection
 * - Alert triggering
 * - Dashboard data
 * - Threshold monitoring
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
const ADMIN_TOKEN = 'your-admin-token-here'; // Replace with actual admin token

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

async function testHealthCheck() {
  logSection('TEST 1: System Health Check');
  
  try {
    const response = await api.get('/monitoring/health');
    
    log('✓ Health check successful', 'green');
    console.log('Status:', response.data.status);
    console.log('Uptime:', response.data.uptime);
    console.log('Database:', response.data.database);
    console.log('Redis:', response.data.redis);
    console.log('Memory:', response.data.memory);
    
    return true;
  } catch (error) {
    log('✗ Health check failed', 'red');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

async function testMetricsCollection() {
  logSection('TEST 2: Metrics Collection');
  
  try {
    const response = await api.get('/monitoring/metrics');
    
    log('✓ Metrics retrieved successfully', 'green');
    console.log('\nOrder Metrics:');
    console.log('- Total Orders:', response.data.orders.total);
    console.log('- Orders Today:', response.data.orders.today);
    console.log('- Creation Rate:', response.data.orders.creationRate);
    
    console.log('\nJob Metrics:');
    console.log('- Total Jobs:', response.data.jobs.total);
    console.log('- Completed:', response.data.jobs.completed);
    console.log('- Failed:', response.data.jobs.failed);
    console.log('- Success Rate:', response.data.jobs.successRate);
    
    console.log('\nWhatsApp Metrics:');
    console.log('- Total Messages:', response.data.whatsapp.total);
    console.log('- Sent:', response.data.whatsapp.sent);
    console.log('- Failed:', response.data.whatsapp.failed);
    console.log('- Success Rate:', response.data.whatsapp.successRate);
    
    console.log('\nAPI Metrics:');
    console.log('- Total Requests:', response.data.api.totalRequests);
    console.log('- Error Rate:', response.data.api.errorRate);
    console.log('- Avg Response Time:', response.data.api.avgResponseTime);
    
    return true;
  } catch (error) {
    log('✗ Metrics collection failed', 'red');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

async function testAlertsList() {
  logSection('TEST 3: Active Alerts');
  
  try {
    const response = await api.get('/monitoring/alerts');
    
    log('✓ Alerts retrieved successfully', 'green');
    console.log(`Found ${response.data.alerts.length} active alerts\n`);
    
    if (response.data.alerts.length > 0) {
      response.data.alerts.forEach((alert, index) => {
        console.log(`Alert ${index + 1}:`);
        console.log('- Type:', alert.alertType);
        console.log('- Severity:', alert.severity);
        console.log('- Message:', alert.message);
        console.log('- Status:', alert.status);
        console.log('- Created:', new Date(alert.createdAt).toLocaleString());
        console.log('');
      });
    } else {
      log('No active alerts (system healthy)', 'green');
    }
    
    return true;
  } catch (error) {
    log('✗ Alerts retrieval failed', 'red');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

async function testDashboard() {
  logSection('TEST 4: Monitoring Dashboard');
  
  try {
    const response = await api.get('/monitoring/dashboard');
    
    log('✓ Dashboard data retrieved successfully', 'green');
    console.log('\nSystem Health:', response.data.health.status);
    console.log('Active Alerts:', response.data.alerts.active);
    console.log('Critical Alerts:', response.data.alerts.critical);
    
    console.log('\nMetrics Summary:');
    console.log('- Orders Today:', response.data.metrics.orders.today);
    console.log('- Jobs Success Rate:', response.data.metrics.jobs.successRate);
    console.log('- WhatsApp Success Rate:', response.data.metrics.whatsapp.successRate);
    console.log('- API Error Rate:', response.data.metrics.api.errorRate);
    
    console.log('\nThreshold Status:');
    Object.entries(response.data.thresholds).forEach(([key, value]) => {
      const status = value.exceeded ? '⚠️  EXCEEDED' : '✓ OK';
      const color = value.exceeded ? 'yellow' : 'green';
      log(`- ${key}: ${status} (${value.current}/${value.threshold})`, color);
    });
    
    return true;
  } catch (error) {
    log('✗ Dashboard retrieval failed', 'red');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

async function testSystemMetrics() {
  logSection('TEST 5: System Metrics (CPU, Memory, Disk)');
  
  try {
    const response = await api.get('/monitoring/system-metrics');
    
    log('✓ System metrics retrieved successfully', 'green');
    
    if (response.data.metrics.length > 0) {
      const latest = response.data.metrics[0];
      console.log('\nLatest System Metrics:');
      console.log('- CPU Usage:', latest.cpuUsage + '%');
      console.log('- Memory Usage:', latest.memoryUsage + '%');
      console.log('- Disk Usage:', latest.diskUsage + '%');
      console.log('- Active Connections:', latest.activeConnections);
      console.log('- Timestamp:', new Date(latest.timestamp).toLocaleString());
      
      // Check for warnings
      if (latest.cpuUsage > 80) {
        log('⚠️  High CPU usage detected', 'yellow');
      }
      if (latest.memoryUsage > 80) {
        log('⚠️  High memory usage detected', 'yellow');
      }
      if (latest.diskUsage > 80) {
        log('⚠️  High disk usage detected', 'yellow');
      }
    } else {
      log('No system metrics available yet', 'yellow');
    }
    
    return true;
  } catch (error) {
    log('✗ System metrics retrieval failed', 'red');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

async function testAlertAcknowledge() {
  logSection('TEST 6: Alert Acknowledgement');
  
  try {
    // First get an active alert
    const alertsResponse = await api.get('/monitoring/alerts');
    
    if (alertsResponse.data.alerts.length === 0) {
      log('No alerts to acknowledge', 'yellow');
      return true;
    }
    
    const alertId = alertsResponse.data.alerts[0].id;
    
    const response = await api.post(`/monitoring/alerts/${alertId}/acknowledge`, {
      acknowledgedBy: 'test-script',
      notes: 'Acknowledged during monitoring test',
    });
    
    log('✓ Alert acknowledged successfully', 'green');
    console.log('Alert ID:', response.data.alert.id);
    console.log('Status:', response.data.alert.status);
    console.log('Acknowledged By:', response.data.alert.acknowledgedBy);
    
    return true;
  } catch (error) {
    log('✗ Alert acknowledgement failed', 'red');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

async function testAlertResolve() {
  logSection('TEST 7: Alert Resolution');
  
  try {
    // Get an acknowledged alert
    const alertsResponse = await api.get('/monitoring/alerts?status=ACKNOWLEDGED');
    
    if (alertsResponse.data.alerts.length === 0) {
      log('No acknowledged alerts to resolve', 'yellow');
      return true;
    }
    
    const alertId = alertsResponse.data.alerts[0].id;
    
    const response = await api.post(`/monitoring/alerts/${alertId}/resolve`, {
      resolvedBy: 'test-script',
      resolution: 'Issue resolved during monitoring test',
    });
    
    log('✓ Alert resolved successfully', 'green');
    console.log('Alert ID:', response.data.alert.id);
    console.log('Status:', response.data.alert.status);
    console.log('Resolved By:', response.data.alert.resolvedBy);
    
    return true;
  } catch (error) {
    log('✗ Alert resolution failed', 'red');
    console.error('Error:', error.response?.data || error.message);
    return false;
  }
}

async function runAllTests() {
  console.clear();
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     MONITORING AND ALERTING SYSTEM TEST SUITE             ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 7,
  };
  
  // Run tests
  if (await testHealthCheck()) results.passed++; else results.failed++;
  if (await testMetricsCollection()) results.passed++; else results.failed++;
  if (await testAlertsList()) results.passed++; else results.failed++;
  if (await testDashboard()) results.passed++; else results.failed++;
  if (await testSystemMetrics()) results.passed++; else results.failed++;
  if (await testAlertAcknowledge()) results.passed++; else results.failed++;
  if (await testAlertResolve()) results.passed++; else results.failed++;
  
  // Summary
  logSection('TEST SUMMARY');
  console.log(`Total Tests: ${results.total}`);
  log(`Passed: ${results.passed}`, 'green');
  if (results.failed > 0) {
    log(`Failed: ${results.failed}`, 'red');
  }
  
  const successRate = ((results.passed / results.total) * 100).toFixed(1);
  console.log(`Success Rate: ${successRate}%`);
  
  if (results.failed === 0) {
    log('\n✓ All tests passed! Monitoring system is working correctly.', 'green');
  } else {
    log('\n✗ Some tests failed. Please check the errors above.', 'red');
  }
}

// Run tests
runAllTests().catch(error => {
  log('\n✗ Test suite failed with error:', 'red');
  console.error(error);
  process.exit(1);
});
