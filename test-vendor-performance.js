const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let vendorId = '';

// Test configuration
const TEST_CONFIG = {
  adminEmail: 'admin@khaacho.com',
  adminPassword: 'admin123',
};

// Helper function to make authenticated requests
async function apiRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ API Error: ${error.response.data.message || error.message}`);
      return null;
    }
    throw error;
  }
}

// Test functions
async function login() {
  console.log('\n🔐 Logging in as admin...');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_CONFIG.adminEmail,
      password: TEST_CONFIG.adminPassword,
    });

    authToken = response.data.data.token;
    console.log('✅ Login successful');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function getFirstVendor() {
  console.log('\n📋 Getting first vendor...');
  const result = await apiRequest('GET', '/vendor-performance?limit=1');
  
  if (result && result.data.performances.length > 0) {
    vendorId = result.data.performances[0].vendor_id;
    console.log(`✅ Found vendor: ${vendorId}`);
    return true;
  }
  
  console.log('⚠️  No vendors found in system');
  return false;
}

async function testGetAllVendorsPerformance() {
  console.log('\n📊 Test: Get All Vendors Performance');
  const result = await apiRequest('GET', '/vendor-performance?sortBy=reliability_score&limit=10');
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} vendor performances`);
    if (result.data.performances.length > 0) {
      const top = result.data.performances[0];
      console.log(`   Top Performer: ${top.vendor_name || top.business_name}`);
      console.log(`   Reliability Score: ${top.reliability_score}`);
      console.log(`   Acceptance Rate: ${top.acceptance_rate}%`);
      console.log(`   Completion Rate: ${top.completion_rate}%`);
    }
    return true;
  }
  return false;
}

async function testGetVendorPerformance() {
  if (!vendorId) {
    console.log('\n⚠️  Skipping: No vendor ID available');
    return false;
  }

  console.log('\n📊 Test: Get Specific Vendor Performance');
  const result = await apiRequest('GET', `/vendor-performance/${vendorId}`);
  
  if (result && result.success) {
    console.log('✅ Retrieved vendor performance');
    console.log(`   Total Orders Assigned: ${result.data.total_orders_assigned}`);
    console.log(`   Orders Accepted: ${result.data.orders_accepted}`);
    console.log(`   Orders Completed: ${result.data.orders_completed}`);
    console.log(`   Acceptance Rate: ${result.data.acceptance_rate}%`);
    console.log(`   Completion Rate: ${result.data.completion_rate}%`);
    console.log(`   Avg Fulfillment Time: ${result.data.avg_fulfillment_time} hours`);
    console.log(`   Reliability Score: ${result.data.reliability_score}/100`);
    return true;
  }
  return false;
}

async function testGetVendorDashboard() {
  if (!vendorId) {
    console.log('\n⚠️  Skipping: No vendor ID available');
    return false;
  }

  console.log('\n📊 Test: Get Vendor Performance Dashboard');
  const result = await apiRequest('GET', `/vendor-performance/${vendorId}/dashboard`);
  
  if (result && result.success) {
    console.log('✅ Retrieved vendor dashboard');
    console.log(`   Vendor: ${result.data.vendor.businessName}`);
    console.log(`   City: ${result.data.vendor.city}`);
    console.log(`   Reliability Score: ${result.data.performance.reliability_score}`);
    console.log(`   Grade: ${result.data.performance.grade.grade} (${result.data.performance.grade.label})`);
    console.log(`   Pending Orders: ${result.data.performance.pendingOrders}`);
    console.log(`   History Records: ${result.data.history.length}`);
    console.log(`   Recent Events: ${result.data.recentEvents.length}`);
    console.log(`   Products Tracked: ${result.data.priceCompetitiveness.totalProducts}`);
    console.log(`   Competitive Products: ${result.data.priceCompetitiveness.competitiveCount}`);
    return true;
  }
  return false;
}

async function testGetVendorHistory() {
  if (!vendorId) {
    console.log('\n⚠️  Skipping: No vendor ID available');
    return false;
  }

  console.log('\n📊 Test: Get Vendor Performance History');
  const result = await apiRequest('GET', `/vendor-performance/${vendorId}/history?periodType=monthly&limit=6`);
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} history records`);
    if (result.data.history.length > 0) {
      const latest = result.data.history[0];
      console.log(`   Latest Period: ${latest.period_start} to ${latest.period_end}`);
      console.log(`   Reliability Score: ${latest.reliability_score}`);
    }
    return true;
  }
  return false;
}

async function testGetVendorEvents() {
  if (!vendorId) {
    console.log('\n⚠️  Skipping: No vendor ID available');
    return false;
  }

  console.log('\n📊 Test: Get Vendor Performance Events');
  const result = await apiRequest('GET', `/vendor-performance/${vendorId}/events?limit=10`);
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} events`);
    if (result.data.events.length > 0) {
      console.log('   Recent events:');
      result.data.events.slice(0, 3).forEach(event => {
        console.log(`   - ${event.event_type} (${event.order_number || 'N/A'})`);
      });
    }
    return true;
  }
  return false;
}

async function testGetVendorPricing() {
  if (!vendorId) {
    console.log('\n⚠️  Skipping: No vendor ID available');
    return false;
  }

  console.log('\n📊 Test: Get Vendor Price Competitiveness');
  const result = await apiRequest('GET', `/vendor-performance/${vendorId}/pricing`);
  
  if (result && result.success) {
    console.log(`✅ Retrieved pricing for ${result.data.count} products`);
    if (result.data.pricing.length > 0) {
      const sample = result.data.pricing[0];
      console.log(`   Sample Product: ${sample.product_name}`);
      console.log(`   Vendor Price: ${sample.vendor_price}`);
      console.log(`   Market Avg: ${sample.market_avg_price}`);
      console.log(`   Deviation: ${sample.price_deviation}%`);
      console.log(`   Competitive: ${sample.is_competitive ? 'Yes' : 'No'}`);
    }
    return true;
  }
  return false;
}

async function testGetTopPerformers() {
  console.log('\n📊 Test: Get Top Performing Vendors');
  const result = await apiRequest('GET', '/vendor-performance/top-performers?limit=5');
  
  if (result && result.success) {
    console.log(`✅ Retrieved top ${result.data.count} performers`);
    result.data.topPerformers.forEach((vendor, index) => {
      console.log(`   ${index + 1}. ${vendor.vendor_name || vendor.business_name} - Score: ${vendor.reliability_score}`);
    });
    return true;
  }
  return false;
}

async function testGetVendorsNeedingAttention() {
  console.log('\n📊 Test: Get Vendors Needing Attention');
  const result = await apiRequest('GET', '/vendor-performance/needs-attention?threshold=70');
  
  if (result && result.success) {
    console.log(`✅ Found ${result.data.count} vendors below threshold ${result.data.threshold}`);
    if (result.data.vendors.length > 0) {
      result.data.vendors.forEach(vendor => {
        console.log(`   - ${vendor.vendor_name || vendor.business_name}: ${vendor.reliability_score}`);
      });
    } else {
      console.log('   All vendors performing well! 🎉');
    }
    return true;
  }
  return false;
}

async function testCompareVendors() {
  console.log('\n📊 Test: Compare Multiple Vendors');
  
  // Get first 3 vendors
  const allVendors = await apiRequest('GET', '/vendor-performance?limit=3');
  if (!allVendors || allVendors.data.performances.length < 2) {
    console.log('⚠️  Need at least 2 vendors for comparison');
    return false;
  }

  const vendorIds = allVendors.data.performances.map(v => v.vendor_id);
  const result = await apiRequest('POST', '/vendor-performance/compare', { vendorIds });
  
  if (result && result.success) {
    console.log(`✅ Compared ${result.data.count} vendors`);
    result.data.comparison.forEach(vendor => {
      console.log(`   ${vendor.businessName}:`);
      console.log(`     Score: ${vendor.performance?.reliability_score || 'N/A'}`);
      console.log(`     Grade: ${vendor.grade.grade} (${vendor.grade.label})`);
    });
    return true;
  }
  return false;
}

async function testRecalculateVendorPerformance() {
  if (!vendorId) {
    console.log('\n⚠️  Skipping: No vendor ID available');
    return false;
  }

  console.log('\n📊 Test: Recalculate Vendor Performance');
  const result = await apiRequest('POST', `/vendor-performance/${vendorId}/recalculate`);
  
  if (result && result.success) {
    console.log('✅ Performance recalculated successfully');
    console.log(`   New Reliability Score: ${result.data.reliability_score}`);
    console.log(`   Acceptance Rate: ${result.data.acceptance_rate}%`);
    console.log(`   Completion Rate: ${result.data.completion_rate}%`);
    return true;
  }
  return false;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Vendor Performance API Tests\n');
  console.log('='.repeat(60));

  const tests = [
    { name: 'Login', fn: login },
    { name: 'Get First Vendor', fn: getFirstVendor },
    { name: 'Get All Vendors Performance', fn: testGetAllVendorsPerformance },
    { name: 'Get Vendor Performance', fn: testGetVendorPerformance },
    { name: 'Get Vendor Dashboard', fn: testGetVendorDashboard },
    { name: 'Get Vendor History', fn: testGetVendorHistory },
    { name: 'Get Vendor Events', fn: testGetVendorEvents },
    { name: 'Get Vendor Pricing', fn: testGetVendorPricing },
    { name: 'Get Top Performers', fn: testGetTopPerformers },
    { name: 'Get Vendors Needing Attention', fn: testGetVendorsNeedingAttention },
    { name: 'Compare Vendors', fn: testCompareVendors },
    { name: 'Recalculate Vendor Performance', fn: testRecalculateVendorPerformance },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test "${test.name}" threw an error:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`   Total Tests: ${tests.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
