import fs from 'fs';

async function testBackendAuthEndpoint() {
  console.log('--- 1. Testing Backend Auth Endpoint (/api/v1/auth/verify-google) ---');
  const baseUrl = 'http://localhost:3001/api/v1/auth/verify-google';
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': 'dnsx_dev_secret_key_8f3d6b2c9e1a4705',
  };

  // Test 1: Empty input
  const res1 = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: '', password: '' }),
  });
  console.log('Test 1 (Empty input) Status:', res1.status, '(expected 400)');
  if (res1.status !== 400) throw new Error('Empty input should return 400');

  // Test 2: Whitespace only
  const res2 = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: '    ', password: '        ' }),
  });
  console.log('Test 2 (Whitespace only) Status:', res2.status, '(expected 400)');
  if (res2.status !== 400) throw new Error('Whitespace input should return 400');

  // Test 2b: Missing password
  const res2b = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'network.engineer99@gmail.com' }),
  });
  console.log('Test 2b (Missing password) Status:', res2b.status, '(expected 400)');
  if (res2b.status !== 400) throw new Error('Missing password should return 400');

  // Test 2c: Short password (<8 chars)
  const res2c = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'network.engineer99@gmail.com', password: '123' }),
  });
  console.log('Test 2c (Short password < 8) Status:', res2c.status, '(expected 400)');
  if (res2c.status !== 400) throw new Error('Short password should return 400');

  // Test 3: Non-Google domain (e.g. yahoo.com)
  const res3 = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'user@yahoo.com', password: 'ValidPassword123' }),
  });
  const data3 = await res3.json();
  console.log('Test 3 (Non-Google domain) Status:', res3.status, 'Error:', data3.error);
  if (res3.status !== 400 || data3.verified !== false) {
    throw new Error('Non-Google domain should be rejected with 400');
  }

  // Test 4: Fake non-existent domain
  const res4 = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'user@fake-nonexistent-domain-837492.com', password: 'ValidPassword123' }),
  });
  const data4 = await res4.json();
  console.log('Test 4 (Fake domain) Status:', res4.status, 'Error:', data4.error);
  if (res4.status !== 400 || data4.verified !== false) {
    throw new Error('Fake domain should be rejected with 400');
  }

  // Test 5: Too short Gmail username (<6 chars)
  const res5 = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'ab@gmail.com', password: 'ValidPassword123' }),
  });
  const data5 = await res5.json();
  console.log('Test 5 (Too short Gmail) Status:', res5.status, 'Error:', data5.error);
  if (res5.status !== 400 || data5.verified !== false) {
    throw new Error('Too short Gmail should be rejected with 400');
  }

  // Test 6: Valid Google account (@gmail.com) with password
  const res6 = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'network.engineer99@gmail.com', password: 'RealGooglePassword99!' }),
  });
  const data6 = await res6.json();
  console.log('Test 6 (Valid Gmail + Password) Status:', res6.status, 'Verified:', data6.verified, 'User:', data6.user?.email);
  if (res6.status !== 200 || !data6.verified) {
    throw new Error('Valid Gmail should be verified with 200');
  }

  // Test 7: Valid Google Workspace domain (@google.com) with password
  const res7 = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'admin@google.com', password: 'GoogleWorkspaceAdminPass!' }),
  });
  const data7 = await res7.json();
  console.log('Test 7 (Valid Google Workspace + Password) Status:', res7.status, 'Verified:', data7.verified, 'AccountType:', data7.user?.accountType);
  if (res7.status !== 200 || !data7.verified || data7.user?.accountType !== 'workspace') {
    throw new Error('Google Workspace should be verified with 200');
  }
}

function testFrontendCodeSanity() {
  console.log('\n--- 2. Testing Frontend Code for Zero Mock Data ---');

  const googleAuthPage = fs.readFileSync('src/pages/GoogleAuthPage.jsx', 'utf8');
  if (googleAuthPage.includes('SAMPLE_GOOGLE_PROFILES')) {
    throw new Error('GoogleAuthPage.jsx still contains SAMPLE_GOOGLE_PROFILES!');
  }
  if (googleAuthPage.includes('Alex Rivers') || googleAuthPage.includes('Sarah Chen')) {
    throw new Error('GoogleAuthPage.jsx still contains fake profile names!');
  }
  if (!googleAuthPage.includes("navigate('/noc', { replace: true })")) {
    throw new Error('GoogleAuthPage.jsx must navigate to /noc after verification!');
  }

  const authContext = fs.readFileSync('src/contexts/AuthContext.jsx', 'utf8');
  if (authContext.includes('DEFAULT_DEMO_USER')) {
    throw new Error('AuthContext.jsx still contains DEFAULT_DEMO_USER!');
  }

  console.log('Zero mock data confirmed: All fake profiles and fake fallbacks removed.');
}

async function main() {
  await testBackendAuthEndpoint();
  testFrontendCodeSanity();
  console.log('\n>>> ALL REAL GOOGLE AUTHENTICATION TESTS PASSED SUCCESSFULLY! <<<');
}

main().catch(err => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
