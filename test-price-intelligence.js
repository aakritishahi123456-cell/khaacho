const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = '';
let productId = '';
let alertId = '';

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

async function getFirstProduct() {
  console.log('\n📦 Getting first product...');
  const result = await apiRequest('GET', '/price-intelligence/analytics?limit=1');
  
  if (result && result.data.analytics.length > 0) {
    productId = result.data.analytics[0].product_id;
    console.log(`✅ Found product: ${productId}`);
    console.log(`   Product: ${result.data.analytics[0].product_name}`);
    return true;
  }
  
  console.log('⚠️  No products found in system');
  return false;
}

async function testGetDashboard() {
  console.log('\n📊 Test: Get Price Intelligence Dashboard');
  const result = await apiRequest('GET', '/price-intelligence/dashboard');
  
  if (result && result.success) {
    console.log('✅ Dashboard retrieved successfully');
    console.log(`   Total Products: ${result.data.summary.total_products}`);
    console.log(`   Avg Volatility: ${result.data.summary.avg_volatility}`);
    console.log(`   Highly Volatile: ${result.data.summary.highly_volatile_count}`);
    console.log(`   Total Alerts: ${result.data.alerts.total_alerts}`);
    console.log(`   Critical Alerts: ${result.data.alerts.critical_alerts}`);
    console.log(`   Volatile Products: ${result.data.volatileProducts.length}`);
    return true;
  }
  return false;
}

async function testGetProductPriceHistory() {
  if (!productId) {
    console.log('\n⚠️  Skipping: No product ID available');
    return false;
  }

  console.log('\n📊 Test: Get Product Price History');
  const result = await apiRequest('GET', `/price-intelligence/products/${productId}/history?limit=10`);
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} price history records`);
    if (result.data.history.length > 0) {
      const latest = result.data.history[0];
      console.log(`   Latest Price: ${latest.price}`);
      console.log(`   Previous Price: ${latest.previous_price || 'N/A'}`);
      console.log(`   Change: ${latest.price_change_percent || 'N/A'}%`);
      console.log(`   Market Avg: ${latest.market_avg_price || 'N/A'}`);
    }
    return true;
  }
  return false;
}

async function testGetMarketAnalytics() {
  if (!productId) {
    console.log('\n⚠️  Skipping: No product ID available');
    return false;
  }

  console.log('\n📊 Test: Get Market Analytics');
  const result = await apiRequest('GET', `/price-intelligence/products/${productId}/analytics`);
  
  if (result && result.success) {
    console.log('✅ Market analytics retrieved');
    console.log(`   Product: ${result.data.product_name}`);
    console.log(`   Current Avg Price: ${result.data.current_avg_price}`);
    console.log(`   Min Price: ${result.data.current_min_price}`);
    console.log(`   Max Price: ${result.data.current_max_price}`);
    console.log(`   Price Range: ${result.data.price_range_percent}%`);
    console.log(`   Total Vendors: ${result.data.total_vendors}`);
    console.log(`   Volatility Score: ${result.data.price_volatility_score}`);
    console.log(`   Stability Rating: ${result.data.price_stability_rating}`);
    console.log(`   Price Trend: ${result.data.price_trend}`);
    console.log(`   30d Change: ${result.data.price_change_30d_percent || 'N/A'}%`);
    return true;
  }
  return false;
}

async function testGetAllMarketAnalytics() {
  console.log('\n📊 Test: Get All Market Analytics');
  const result = await apiRequest('GET', '/price-intelligence/analytics?sortBy=price_volatility_score&limit=5');
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} market analytics`);
    result.data.analytics.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.product_name}`);
      console.log(`      Volatility: ${item.price_volatility_score} (${item.price_stability_rating})`);
      console.log(`      Avg Price: ${item.current_avg_price}`);
      console.log(`      Trend: ${item.price_trend}`);
    });
    return true;
  }
  return false;
}

async function testGetPriceAlerts() {
  console.log('\n📊 Test: Get Price Alerts');
  const result = await apiRequest('GET', '/price-intelligence/alerts?isAcknowledged=false&limit=10');
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} unacknowledged alerts`);
    if (result.data.alerts.length > 0) {
      alertId = result.data.alerts[0].id;
      result.data.alerts.slice(0, 3).forEach(alert => {
        console.log(`   - ${alert.title} (${alert.severity})`);
        console.log(`     Product: ${alert.product_name}`);
        console.log(`     Change: ${alert.price_change_percent}%`);
      });
    } else {
      console.log('   No unacknowledged alerts (system is healthy!)');
    }
    return true;
  }
  return false;
}

async function testAcknowledgePriceAlert() {
  if (!alertId) {
    console.log('\n⚠️  Skipping: No alert ID available');
    return false;
  }

  console.log('\n📊 Test: Acknowledge Price Alert');
  const result = await apiRequest('POST', `/price-intelligence/alerts/${alertId}/acknowledge`, {
    notes: 'Test acknowledgement - price change verified'
  });
  
  if (result && result.success) {
    console.log('✅ Alert acknowledged successfully');
    return true;
  }
  return false;
}

async function testGetLowestPriceVendor() {
  if (!productId) {
    console.log('\n⚠️  Skipping: No product ID available');
    return false;
  }

  console.log('\n📊 Test: Get Lowest Price Vendor');
  const result = await apiRequest('GET', `/price-intelligence/products/${productId}/lowest-price-vendor`);
  
  if (result && result.success) {
    console.log('✅ Lowest price vendor found');
    console.log(`   Vendor: ${result.data.vendor_name}`);
    console.log(`   Price: ${result.data.vendor_price}`);
    console.log(`   Market Avg: ${result.data.market_avg}`);
    console.log(`   Deviation: ${result.data.deviation_from_avg}%`);
    return true;
  }
  return false;
}

async function testGetPriceComparison() {
  if (!productId) {
    console.log('\n⚠️  Skipping: No product ID available');
    return false;
  }

  console.log('\n📊 Test: Get Price Comparison');
  const result = await apiRequest('GET', `/price-intelligence/products/${productId}/comparison`);
  
  if (result && result.success) {
    console.log(`✅ Retrieved price comparison for ${result.data.count} vendors`);
    result.data.comparison.slice(0, 3).forEach((vendor, index) => {
      console.log(`   ${index + 1}. ${vendor.vendor_name}`);
      console.log(`      Price: ${vendor.vendor_price} (${vendor.price_rating})`);
      console.log(`      Deviation: ${vendor.deviation_from_avg}%`);
      console.log(`      Stock: ${vendor.stock}`);
    });
    return true;
  }
  return false;
}

async function testGetPriceTrends() {
  if (!productId) {
    console.log('\n⚠️  Skipping: No product ID available');
    return false;
  }

  console.log('\n📊 Test: Get Price Trends');
  const result = await apiRequest('GET', `/price-intelligence/products/${productId}/trends?days=7`);
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} days of price trends`);
    if (result.data.trends.length > 0) {
      console.log('   Recent trends:');
      result.data.trends.slice(0, 3).forEach(trend => {
        console.log(`   ${trend.date}: Avg ${trend.avg_price} (${trend.vendors_count} vendors)`);
      });
    }
    return true;
  }
  return false;
}

async function testGetVolatileProducts() {
  console.log('\n📊 Test: Get Volatile Products');
  const result = await apiRequest('GET', '/price-intelligence/volatile-products?threshold=40&limit=5');
  
  if (result && result.success) {
    console.log(`✅ Retrieved ${result.data.count} volatile products`);
    result.data.products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.product_name}`);
      console.log(`      Volatility: ${product.price_volatility_score} (${product.price_stability_rating})`);
      console.log(`      Avg Price: ${product.current_avg_price}`);
    });
    return true;
  }
  return false;
}

async function testCalculatePriceVolatility() {
  if (!productId) {
    console.log('\n⚠️  Skipping: No product ID available');
    return false;
  }

  console.log('\n📊 Test: Calculate Price Volatility');
  const result = await apiRequest('GET', `/price-intelligence/products/${productId}/volatility?days=30`);
  
  if (result && result.success) {
    console.log('✅ Volatility calculated');
    console.log(`   Score: ${result.data.volatilityScore}`);
    console.log(`   Rating: ${result.data.rating}`);
    console.log(`   Period: ${result.data.period}`);
    return true;
  }
  return false;
}

async function testUpdateMarketAnalytics() {
  if (!productId) {
    console.log('\n⚠️  Skipping: No product ID available');
    return false;
  }

  console.log('\n📊 Test: Update Market Analytics');
  const result = await apiRequest('POST', `/price-intelligence/products/${productId}/update-analytics`);
  
  if (result && result.success) {
    console.log('✅ Market analytics updated successfully');
    return true;
  }
  return false;
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Price Intelligence API Tests\n');
  console.log('='.repeat(60));

  const tests = [
    { name: 'Login', fn: login },
    { name: 'Get First Product', fn: getFirstProduct },
    { name: 'Get Dashboard', fn: testGetDashboard },
    { name: 'Get Product Price History', fn: testGetProductPriceHistory },
    { name: 'Get Market Analytics', fn: testGetMarketAnalytics },
    { name: 'Get All Market Analytics', fn: testGetAllMarketAnalytics },
    { name: 'Get Price Alerts', fn: testGetPriceAlerts },
    { name: 'Acknowledge Price Alert', fn: testAcknowledgePriceAlert },
    { name: 'Get Lowest Price Vendor', fn: testGetLowestPriceVendor },
    { name: 'Get Price Comparison', fn: testGetPriceComparison },
    { name: 'Get Price Trends', fn: testGetPriceTrends },
    { name: 'Get Volatile Products', fn: testGetVolatileProducts },
    { name: 'Calculate Price Volatility', fn: testCalculatePriceVolatility },
    { name: 'Update Market Analytics', fn: testUpdateMarketAnalytics },
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
