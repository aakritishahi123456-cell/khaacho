const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

/**
 * Security Test Suite
 * Tests authentication, authorization, rate limiting, and input validation
 */

console.log('=================================');
console.log('Security Test Suite');
console.log('=================================\n');

// Test 1: Authentication - No Token
async function testNoToken() {
  console.log('Test 1: Authentication - No Token');
  try {
    await axios.get(`${BASE_URL}/orders`);
    console.log('✗ FAILED: Should require authentication\n');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✓ PASSED: Returns 401 Unauthorized\n');
    } else {
      console.log(`✗ FAILED: Unexpected status ${error.response?.status}\n`);
    }
  }
}

// Test 2: Authentication - Invalid Token
async function testInvalidToken() {
  console.log('Test 2: Authentication - Invalid Token');
  try {
    await axios.get(`${BASE_URL}/orders`, {
      headers: { Authorization: 'Bearer invalid_token_12345' },
    });
    console.log('✗ FAILED: Should reject invalid token\n');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✓ PASSED: Returns 401 Unauthorized\n');
    } else {
      console.log(`✗ FAILED: Unexpected status ${error.response?.status}\n`);
    }
  }
}

// Test 3: Input Validation - Invalid Email
async function testInvalidEmail() {
  console.log('Test 3: Input Validation - Invalid Email');
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: 'not-an-email',
      password: 'password123',
    });
    console.log('✗ FAILED: Should reject invalid email\n');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ PASSED: Returns 400 Bad Request\n');
      console.log('  Validation errors:', error.response.data.errors || error.response.data.message);
      console.log('');
    } else {
      console.log(`✗ FAILED: Unexpected status ${error.response?.status}\n`);
    }
  }
}

// Test 4: Rate Limiting
async function testRateLimiting() {
  console.log('Test 4: Rate Limiting (sending 10 rapid requests)');
  let rateLimited = false;
  
  for (let i = 1; i <= 10; i++) {
    try {
      await axios.get(`${BASE_URL}/health`);
    } catch (error) {
      if (error.response?.status === 429) {
        rateLimited = true;
        console.log(`✓ PASSED: Rate limited after ${i} requests\n`);
        break;
      }
    }
  }
  
  if (!rateLimited) {
    console.log('⚠ INFO: Rate limit not reached with 10 requests (limit may be higher)\n');
  }
}

// Test 5: CORS Headers
async function testCORSHeaders() {
  console.log('Test 5: CORS Headers');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    const headers = response.headers;
    
    if (headers['access-control-allow-origin']) {
      console.log('✓ PASSED: CORS headers present\n');
    } else {
      console.log('✗ FAILED: CORS headers missing\n');
    }
  } catch (error) {
    console.log('✗ FAILED: Could not check CORS headers\n');
  }
}

// Test 6: Security Headers
async function testSecurityHeaders() {
  console.log('Test 6: Security Headers');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    const headers = response.headers;
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
    ];
    
    let allPresent = true;
    for (const header of securityHeaders) {
      if (!headers[header]) {
        console.log(`  ✗ Missing: ${header}`);
        allPresent = false;
      }
    }
    
    if (allPresent) {
      console.log('✓ PASSED: All security headers present\n');
    } else {
      console.log('✗ FAILED: Some security headers missing\n');
    }
    
    // Check X-Powered-By is removed
    if (!headers['x-powered-by']) {
      console.log('✓ PASSED: X-Powered-By header removed\n');
    } else {
      console.log('✗ FAILED: X-Powered-By header still present\n');
    }
  } catch (error) {
    console.log('✗ FAILED: Could not check security headers\n');
  }
}

// Test 7: SQL Injection Protection
async function testSQLInjection() {
  console.log('Test 7: SQL Injection Protection');
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: "admin@test.com' OR '1'='1",
      password: "password' OR '1'='1",
    });
    console.log('⚠ WARNING: Request accepted (should be sanitized)\n');
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 401) {
      console.log('✓ PASSED: Malicious input rejected or sanitized\n');
    } else {
      console.log(`✗ FAILED: Unexpected status ${error.response?.status}\n`);
    }
  }
}

// Test 8: XSS Protection
async function testXSSProtection() {
  console.log('Test 8: XSS Protection');
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: '<script>alert("xss")</script>@test.com',
      password: 'password123',
    });
    console.log('⚠ WARNING: Request accepted (should be sanitized)\n');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ PASSED: XSS attempt rejected\n');
    } else {
      console.log(`✗ FAILED: Unexpected status ${error.response?.status}\n`);
    }
  }
}

// Test 9: Large Payload Protection
async function testLargePayload() {
  console.log('Test 9: Large Payload Protection');
  try {
    const largeData = 'x'.repeat(15 * 1024 * 1024); // 15MB
    await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@test.com',
      password: largeData,
    });
    console.log('✗ FAILED: Large payload accepted\n');
  } catch (error) {
    if (error.code === 'ERR_BAD_REQUEST' || error.response?.status === 413) {
      console.log('✓ PASSED: Large payload rejected\n');
    } else {
      console.log(`⚠ INFO: Error: ${error.message}\n`);
    }
  }
}

// Test 10: Health Endpoint (Public)
async function testHealthEndpoint() {
  console.log('Test 10: Health Endpoint (Public Access)');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status === 200 && response.data.status === 'ok') {
      console.log('✓ PASSED: Health endpoint accessible\n');
    } else {
      console.log('✗ FAILED: Health endpoint returned unexpected response\n');
    }
  } catch (error) {
    console.log('✗ FAILED: Health endpoint not accessible\n');
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testHealthEndpoint();
    await testNoToken();
    await testInvalidToken();
    await testInvalidEmail();
    await testSecurityHeaders();
    await testCORSHeaders();
    await testSQLInjection();
    await testXSSProtection();
    await testLargePayload();
    await testRateLimiting();
    
    console.log('=================================');
    console.log('Security Tests Completed');
    console.log('=================================\n');
    console.log('Note: Some tests may show warnings instead of failures.');
    console.log('This is normal if the security measure is implemented differently.\n');
  } catch (error) {
    console.error('Test suite error:', error.message);
  }
}

// Run tests
runAllTests();
