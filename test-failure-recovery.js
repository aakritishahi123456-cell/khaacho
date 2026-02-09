const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';
let authToken = '';

// Test credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@khaacho.com',
  password: 'admin123',
};

/**
 * Login and get auth token
 */
async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, ADMIN_CREDENTIALS);
    authToken = response.data.data.token;
    console.log('✓ Logged in successfully');
    return true;
  } catch (error) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get recovery dashboard
 */
async function getRecoveryDashboard() {
  try {
    const response = await axios.get(`${BASE_URL}/recovery/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    console.log('\n=== Recovery Dashboard ===');
    console.log(JSON.stringify(response.data.data.stats, null, 2));
    return true;
  } catch (error) {
    console.error('✗ Failed to get recovery dashboard:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get pending webhook events
 */
async function getPendingWebhookEvents() {
  try {
    const response = await axios.get(`${BASE_URL}/recovery/webhook-events/pending`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    console.log('\n=== Pending Webhook Events ===');
    console.log(`Count: ${response.data.data.count}`);
    if (response.data.data.count > 0) {
      console.log('Events:', JSON.stringify(response.data.data.events.slice(0, 3), null, 2));
    }
    return true;
  } catch (error) {
    console.error('✗ Failed to get pending webhook events:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get failed webhook events
 */
async function getFailedWebhookEvents() {
  try {
    const response = await axios.get(`${BASE_URL}/recovery/webhook-events/failed`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    console.log('\n=== Failed Webhook Events ===');
    console.log(`Count: ${response.data.data.count}`);
    if (response.data.data.count > 0) {
      console.log('Events:', JSON.stringify(response.data.data.events.slice(0, 3), null, 2));
    }
    return true;
  } catch (error) {
    console.error('✗ Failed to get failed webhook events:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get incomplete workflows
 */
async function getIncompleteWorkflows() {
  try {
    const response = await axios.get(`${BASE_URL}/recovery/workflows/incomplete`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    console.log('\n=== Incomplete Workflows ===');
    console.log(`Count: ${response.data.data.count}`);
    if (response.data.data.count > 0) {
      console.log('Workflows:', JSON.stringify(response.data.data.workflows.slice(0, 3), null, 2));
    }
    return true;
  } catch (error) {
    console.error('✗ Failed to get incomplete workflows:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Get pending order recoveries
 */
async function getPendingOrderRecoveries() {
  try {
    const response = await axios.get(`${BASE_URL}/recovery/orders/pending`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    
    console.log('\n=== Pending Order Recoveries ===');
    console.log(`Count: ${response.data.data.count}`);
    if (response.data.data.count > 0) {
      console.log('Recoveries:', JSON.stringify(response.data.data.recoveries.slice(0, 3), null, 2));
    }
    return true;
  } catch (error) {
    console.error('✗ Failed to get pending order recoveries:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Trigger manual recovery
 */
async function triggerRecovery() {
  try {
    const response = await axios.post(
      `${BASE_URL}/recovery/trigger`,
      { type: 'all' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    console.log('\n=== Manual Recovery Triggered ===');
    console.log(response.data.data.message);
    return true;
  } catch (error) {
    console.error('✗ Failed to trigger recovery:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Run cleanup
 */
async function runCleanup() {
  try {
    const response = await axios.post(
      `${BASE_URL}/recovery/cleanup`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    console.log('\n=== Cleanup Completed ===');
    console.log(response.data.data.message);
    return true;
  } catch (error) {
    console.error('✗ Failed to run cleanup:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=================================');
  console.log('Failure Recovery System Tests');
  console.log('=================================\n');

  // Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.error('\nTests aborted: Login failed');
    return;
  }

  // Wait a bit for system to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Run tests
  await getRecoveryDashboard();
  await getPendingWebhookEvents();
  await getFailedWebhookEvents();
  await getIncompleteWorkflows();
  await getPendingOrderRecoveries();
  
  // Optional: Trigger recovery (commented out by default)
  // await triggerRecovery();
  
  // Optional: Run cleanup (commented out by default)
  // await runCleanup();

  console.log('\n=================================');
  console.log('Tests Completed');
  console.log('=================================\n');
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
