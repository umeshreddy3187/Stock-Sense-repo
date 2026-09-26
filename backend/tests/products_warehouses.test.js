const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.join(__dirname, '../data/test_products_wh.db');
process.env.DATABASE_PATH = testDbPath;
process.env.DISABLE_SEED = 'true';

const { getDatabase } = require('../src/config/database');
const app = require('../src/app');

let server;
let baseUrl;

function setupDb() {
  const db = getDatabase(testDbPath);
  db.exec(`
    DELETE FROM stock_ledger;
    DELETE FROM delivery_order_items;
    DELETE FROM delivery_orders;
    DELETE FROM purchase_receipt_items;
    DELETE FROM purchase_receipts;
    DELETE FROM internal_transfer_items;
    DELETE FROM internal_transfers;
    DELETE FROM inventory_adjustments;
    DELETE FROM products;
    DELETE FROM warehouses;
  `);

  db.prepare(`
    INSERT INTO warehouses (id, name, code, address)
    VALUES (1, 'Main Depot', 'WH-MAIN-01', '100 Central Way')
  `).run();

  db.prepare(`
    INSERT INTO products (id, sku, name, category, current_stock, min_stock, warehouse_id, unit)
    VALUES (1, 'PROD-ALPHA', 'Alpha Keyboard', 'Electronics', 50, 10, 1, 'units')
  `).run();

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

test('1. Products - List products and get by ID', async () => {
  const listRes = await fetch(`${baseUrl}/api/products`);
  assert.strictEqual(listRes.status, 200);
  const listBody = await listRes.json();
  assert.strictEqual(listBody.success, true);
  assert.ok(listBody.data.length >= 1);
  assert.strictEqual(listBody.data[0].sku, 'PROD-ALPHA');

  const singleRes = await fetch(`${baseUrl}/api/products/${listBody.data[0].id}`);
  assert.strictEqual(singleRes.status, 200);
  const singleBody = await singleRes.json();
  assert.strictEqual(singleBody.data.name, 'Alpha Keyboard');
});

test('2. Products - Create new product and reject duplicates', async () => {
  const createRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: 'PROD-BETA',
      name: 'Beta Mouse',
      category: 'Peripherals',
      current_stock: 25,
      min_stock: 5,
      warehouse_id: 1,
      unit: 'pcs'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createBody = await createRes.json();
  assert.strictEqual(createBody.success, true);
  assert.strictEqual(createBody.data.sku, 'PROD-BETA');

  // Duplicate SKU test
  const dupRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: 'PROD-BETA',
      name: 'Duplicate Beta Mouse',
      category: 'Peripherals'
    })
  });
  assert.strictEqual(dupRes.status, 400);
});

test('3. Products - Update and delete product', async () => {
  const createRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: 'PROD-GAMMA',
      name: 'Gamma Webcam',
      category: 'Video',
      current_stock: 12
    })
  });
  const created = (await createRes.json()).data;

  // Update
  const updateRes = await fetch(`${baseUrl}/api/products/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Gamma 4K Webcam'
    })
  });
  assert.strictEqual(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.strictEqual(updateBody.data.name, 'Gamma 4K Webcam');

  // Delete
  const delRes = await fetch(`${baseUrl}/api/products/${created.id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delRes.status, 200);

  const getRes = await fetch(`${baseUrl}/api/products/${created.id}`);
  assert.strictEqual(getRes.status, 404);
});

test('4. Warehouses - List, create and get warehouse', async () => {
  const listRes = await fetch(`${baseUrl}/api/warehouses`);
  assert.strictEqual(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(listBody.data.length >= 1);

  const createRes = await fetch(`${baseUrl}/api/warehouses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'South Hub',
      code: 'WH-SOUTH-04',
      address: '450 Southern Blvd'
    })
  });
  assert.strictEqual(createRes.status, 201);
  const createBody = await createRes.json();
  assert.strictEqual(createBody.data.code, 'WH-SOUTH-04');

  const getRes = await fetch(`${baseUrl}/api/warehouses/${createBody.data.id}`);
  assert.strictEqual(getRes.status, 200);
  const getBody = await getRes.json();
  assert.strictEqual(getBody.data.name, 'South Hub');
});
