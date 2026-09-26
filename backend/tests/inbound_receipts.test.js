const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.join(__dirname, '../data/test_receipts.db');
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
    DELETE FROM purchase_receipt_items;
    DELETE FROM purchase_receipts;
    DELETE FROM products;
    DELETE FROM warehouses;
  `);

  db.prepare(`
    INSERT INTO warehouses (id, name, code, address)
    VALUES (1, 'Central Inbound Depot', 'WH-REC-01', '100 Dock St')
  `).run();

  db.prepare(`
    INSERT INTO products (id, sku, name, category, current_stock, unit)
    VALUES (1, 'REC-PROD-01', 'Supply Cables', 'Electronics', 10, 'units')
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

test('1. Inbound Receipts - Create DRAFT receipt and list', async () => {
  const res = await fetch(`${baseUrl}/api/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      supplier_name: 'Apex Semiconductor Components',
      supplier_ref: 'PO-APEX-9901',
      warehouse_id: 1,
      notes: 'Initial test shipment',
      items: [
        { product_id: 1, quantity_ordered: 20, unit_cost: 15.50 }
      ]
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.data.status, 'DRAFT');

  // List receipts
  const listRes = await fetch(`${baseUrl}/api/receipts`);
  assert.strictEqual(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(listBody.data.length >= 1);
  assert.strictEqual(listBody.data[0].items.length, 1);
});

test('2. Inbound Receipts - Receive and increase inventory with ledger audit', async () => {
  const db = getDatabase(testDbPath);
  const initialProd = db.prepare('SELECT current_stock FROM products WHERE id = 1').get();
  assert.strictEqual(initialProd.current_stock, 10);

  // Get receipt
  const listRes = await fetch(`${baseUrl}/api/receipts`);
  const receipts = (await listRes.json()).data;
  const receiptId = receipts[0].id;

  // Process receipt
  const receiveRes = await fetch(`${baseUrl}/api/receipts/${receiptId}/receive`, {
    method: 'POST'
  });
  assert.strictEqual(receiveRes.status, 200);
  const receiveBody = await receiveRes.json();
  assert.strictEqual(receiveBody.success, true);
  assert.strictEqual(receiveBody.data.status, 'RECEIVED');

  // Verify stock incremented: 10 + 20 = 30
  const updatedProd = db.prepare('SELECT current_stock FROM products WHERE id = 1').get();
  assert.strictEqual(updatedProd.current_stock, 30);

  // Verify stock ledger movement
  const ledgerEntries = db.prepare(`
    SELECT * FROM stock_ledger WHERE product_id = 1 AND movement_type = 'RECEIPT'
  `).all();
  assert.strictEqual(ledgerEntries.length, 1);
  assert.strictEqual(ledgerEntries[0].quantity_change, 20);
  assert.strictEqual(ledgerEntries[0].quantity_before, 10);
  assert.strictEqual(ledgerEntries[0].quantity_after, 30);

  // Double receiving should be rejected
  const dupRes = await fetch(`${baseUrl}/api/receipts/${receiptId}/receive`, {
    method: 'POST'
  });
  assert.strictEqual(dupRes.status, 400);
});
