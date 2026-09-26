const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.join(__dirname, '../data/test_transfers_adj.db');
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
    DELETE FROM internal_transfer_items;
    DELETE FROM internal_transfers;
    DELETE FROM inventory_adjustments;
    DELETE FROM products;
    DELETE FROM warehouses;
  `);

  db.prepare(`
    INSERT INTO warehouses (id, name, code, address)
    VALUES 
      (1, 'Source Hub Alpha', 'WH-ALPHA-01', '100 Alpha St'),
      (2, 'Destination Depot Beta', 'WH-BETA-02', '200 Beta Ave')
  `).run();

  db.prepare(`
    INSERT INTO products (id, sku, name, category, current_stock, unit)
    VALUES (1, 'TRANS-001', 'Industrial Switch 24-Port', 'Networking', 50, 'units')
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

test('1. Internal Transfers - Reject invalid source/dest and excess quantity', async () => {
  // Same source and dest
  const sameWhRes = await fetch(`${baseUrl}/api/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_warehouse_id: 1,
      destination_warehouse_id: 1,
      items: [{ product_id: 1, quantity: 5 }]
    })
  });
  assert.strictEqual(sameWhRes.status, 400);

  // Quantity greater than current stock (50)
  const excessRes = await fetch(`${baseUrl}/api/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_warehouse_id: 1,
      destination_warehouse_id: 2,
      items: [{ product_id: 1, quantity: 100 }]
    })
  });
  assert.strictEqual(excessRes.status, 400);
});

test('2. Internal Transfers - Lifecycle: Create -> Dispatch -> Complete', async () => {
  const createRes = await fetch(`${baseUrl}/api/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_warehouse_id: 1,
      destination_warehouse_id: 2,
      notes: 'Transfer batch to replenish Depot Beta',
      items: [{ product_id: 1, quantity: 15 }]
    })
  });
  assert.strictEqual(createRes.status, 201);
  const transfer = (await createRes.json()).data;
  assert.strictEqual(transfer.status, 'DRAFT');

  // Dispatch
  const dispatchRes = await fetch(`${baseUrl}/api/transfers/${transfer.id}/dispatch`, {
    method: 'POST'
  });
  assert.strictEqual(dispatchRes.status, 200);
  assert.strictEqual((await dispatchRes.json()).data.status, 'IN_TRANSIT');

  // Complete
  const completeRes = await fetch(`${baseUrl}/api/transfers/${transfer.id}/complete`, {
    method: 'POST'
  });
  assert.strictEqual(completeRes.status, 200);
  assert.strictEqual((await completeRes.json()).data.status, 'COMPLETED');

  // Verify Ledger record
  const db = getDatabase(testDbPath);
  const ledger = db.prepare("SELECT * FROM stock_ledger WHERE movement_type = 'TRANSFER'").all();
  assert.ok(ledger.length >= 1);
});

test('3. Inventory Adjustments - Cycle count reconciliation updates stock & creates audit ledger', async () => {
  const db = getDatabase(testDbPath);
  // Current stock of product 1 is 50
  const adjRes = await fetch(`${baseUrl}/api/adjustments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: 1,
      warehouse_id: 1,
      counted_quantity: 48,
      reason: '2 units damaged during storage handling'
    })
  });

  assert.strictEqual(adjRes.status, 201);
  const adjBody = await adjRes.json();
  assert.strictEqual(adjBody.success, true);
  assert.strictEqual(adjBody.data.system_quantity, 50);
  assert.strictEqual(adjBody.data.counted_quantity, 48);
  assert.strictEqual(adjBody.data.variance, -2);
  assert.strictEqual(adjBody.data.new_stock, 48);

  // Verify product table stock is now 48
  const updatedProd = db.prepare('SELECT current_stock FROM products WHERE id = 1').get();
  assert.strictEqual(updatedProd.current_stock, 48);

  // Verify adjustment entry in stock ledger
  const adjLedger = db.prepare("SELECT * FROM stock_ledger WHERE movement_type = 'ADJUSTMENT'").get();
  assert.ok(adjLedger);
  assert.strictEqual(adjLedger.quantity_change, -2);
  assert.strictEqual(adjLedger.quantity_before, 50);
  assert.strictEqual(adjLedger.quantity_after, 48);
});
