const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.join(__dirname, '../data/test_auth.db');
process.env.DATABASE_PATH = testDbPath;
process.env.DISABLE_SEED = 'true';

const { getDatabase } = require('../src/config/database');
const app = require('../src/app');

let server;
let baseUrl;

function setupDb() {
  const db = getDatabase(testDbPath);
  db.exec('DELETE FROM users;');
  return db;
}

test.before(async () => {
  setupDb();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  if (server) server.close();
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  }
});

test('1. Auth - Register new user and reject duplicates', async () => {
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alex Morgan',
      email: 'alex.m@stocksense.io',
      password: 'SecurePassword123!',
      role: 'Inventory Manager'
    })
  });
  assert.strictEqual(regRes.status, 201);
  const regBody = await regRes.json();
  assert.strictEqual(regBody.success, true);
  assert.strictEqual(regBody.data.email, 'alex.m@stocksense.io');

  // Duplicate register
  const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Alex Morgan',
      email: 'alex.m@stocksense.io',
      password: 'AnotherPassword456!'
    })
  });
  assert.strictEqual(dupRes.status, 400);
});

test('2. Auth - Login validation', async () => {
  // Invalid credentials
  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.m@stocksense.io',
      password: 'WrongPassword'
    })
  });
  assert.strictEqual(badLogin.status, 401);

  // Successful login
  const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.m@stocksense.io',
      password: 'SecurePassword123!'
    })
  });
  assert.strictEqual(goodLogin.status, 200);
  const loginBody = await goodLogin.json();
  assert.strictEqual(loginBody.success, true);
  assert.strictEqual(loginBody.data.email, 'alex.m@stocksense.io');
  assert.strictEqual(loginBody.data.password, undefined); // password not returned
});

test('3. Auth - OTP password reset flow', async () => {
  // Request OTP
  const otpRes = await fetch(`${baseUrl}/api/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex.m@stocksense.io' })
  });
  assert.strictEqual(otpRes.status, 200);
  const otpBody = await otpRes.json();
  assert.strictEqual(otpBody.success, true);
  const code = otpBody.data.otp;
  assert.ok(code);

  // Reset password
  const resetRes = await fetch(`${baseUrl}/api/auth/otp/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.m@stocksense.io',
      otp: code,
      newPassword: 'BrandNewPassword2026!'
    })
  });
  assert.strictEqual(resetRes.status, 200);

  // Login with new password
  const newLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'alex.m@stocksense.io',
      password: 'BrandNewPassword2026!'
    })
  });
  assert.strictEqual(newLogin.status, 200);
});
