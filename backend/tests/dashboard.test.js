const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const testDbPath = path.join(__dirname, '../data/test_dashboard.db');
process.env.DATABASE_PATH = testDbPath;
process.env.DISABLE_SEED = 'true';

const { getDatabase } = require('../src/config/database');
const app = require('../src/app');

let server;
let baseUrl;

function resetTestDatabase() {
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  }
  const db = getDatabase(testDbPath);
  db.exec(`
    DELETE FROM stock_ledger;
    DELETE FROM delivery_order_items;
    DELETE FROM delivery_orders;
    DELETE FROM products;
    DELETE FROM warehouses;
  `);

  // Seed 2 warehouses
  db.prepare("INSERT INTO warehouses (id, name, code, address) VALUES (1, 'Alpha Central WH', 'WH-ALPHA', '100 Alpha St')").run();
  db.prepare("INSERT INTO warehouses (id, name, code, address) VALUES (2, 'Beta Coastal WH', 'WH-BETA', '200 Beta Blvd')").run();

  // Seed 4 products
  // Product 1: In WH 1, stock 50, min 10 -> Healthy
  db.prepare("INSERT INTO products (id, sku, name, category, current_stock, min_stock, warehouse_id, unit) VALUES (1, 'SKU-H1', 'Keyboard', 'Electronics', 50, 10, 1, 'units')").run();
  // Product 2: In WH 1, stock 5, min 10 -> Low stock (5 <= 10)
  db.prepare("INSERT INTO products (id, sku, name, category, current_stock, min_stock, warehouse_id, unit) VALUES (2, 'SKU-L1', 'Monitor', 'Electronics', 5, 10, 1, 'units')").run();
  // Product 3: In WH 2, stock 0, min 5 -> Out of stock (0)
  db.prepare("INSERT INTO products (id, sku, name, category, current_stock, min_stock, warehouse_id, unit) VALUES (3, 'SKU-O1', 'Desk', 'Furniture', 0, 5, 2, 'units')").run();
  // Product 4: In WH 2, stock 30, min 15 -> Healthy
  db.prepare("INSERT INTO products (id, sku, name, category, current_stock, min_stock, warehouse_id, unit) VALUES (4, 'SKU-H2', 'Chair', 'Furniture', 30, 15, 2, 'units')").run();

  // Seed stock ledger movements
  // Receipt 50 keyboards
  db.prepare(`
    INSERT INTO stock_ledger (id, product_id, movement_type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, timestamp, notes)
    VALUES (1, 1, 'RECEIPT', 'PURCHASE_RECEIPT', 101, 50, 0, 50, datetime('now', '-2 days'), 'Supplier intake')
  `).run();
  // Delivery 10 keyboards (Stock out)
  db.prepare(`
    INSERT INTO stock_ledger (id, product_id, movement_type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, timestamp, notes)
    VALUES (2, 1, 'DELIVERY', 'DELIVERY_ORDER', 201, -10, 50, 40, datetime('now', '-1 day'), 'Customer delivery')
  `).run();

  return db;
}

test.before(async () => {
  resetTestDatabase();
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

test('1. Dashboard Summary KPI Metrics', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/summary`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.success, true);

  const { data } = body;
  assert.strictEqual(data.total_products, 4);
  assert.strictEqual(data.total_stock_quantity, 85); // 50 + 5 + 0 + 30
  assert.strictEqual(data.total_warehouses, 2);
  assert.strictEqual(data.low_stock_items, 1); // Monitor (5 <= 10)
  assert.strictEqual(data.out_of_stock_items, 1); // Desk (0)
  assert.strictEqual(data.healthy_stock_items, 2); // Keyboard, Chair
  assert.strictEqual(data.recent_movements_count, 2);
});

test('2. Dashboard Summary with Warehouse Filter', async () => {
  // Filter by Warehouse 1 (Alpha)
  const res = await fetch(`${baseUrl}/api/dashboard/summary?warehouseId=1`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  const { data } = body;

  assert.strictEqual(data.total_products, 2); // Keyboard & Monitor
  assert.strictEqual(data.total_stock_quantity, 55); // 50 + 5
  assert.strictEqual(data.low_stock_items, 1);
  assert.strictEqual(data.out_of_stock_items, 0);
  assert.strictEqual(data.healthy_stock_items, 1);
});

test('3. Inventory Overview - Categories & Warehouse Distribution', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/inventory`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  const { data } = body;

  assert.ok(Array.isArray(data.category_distribution));
  assert.strictEqual(data.category_distribution.length, 2); // Electronics and Furniture
  const electronics = data.category_distribution.find(c => c.category === 'Electronics');
  assert.strictEqual(electronics.total_stock, 55);

  assert.ok(Array.isArray(data.stock_by_warehouse));
  assert.strictEqual(data.stock_by_warehouse.length, 2);
  const whAlpha = data.stock_by_warehouse.find(w => w.warehouse_code === 'WH-ALPHA');
  assert.strictEqual(whAlpha.total_stock, 55);
});

test('4. Warehouse Overview API', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/warehouses`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  const { data } = body;

  assert.strictEqual(data.length, 2);
  const alpha = data.find(w => w.code === 'WH-ALPHA');
  assert.strictEqual(alpha.product_count, 2);
  assert.strictEqual(alpha.total_quantity, 55);
  assert.strictEqual(alpha.low_stock_count, 1);
  assert.strictEqual(alpha.out_of_stock_count, 0);

  const beta = data.find(w => w.code === 'WH-BETA');
  assert.strictEqual(beta.product_count, 2);
  assert.strictEqual(beta.total_quantity, 30);
  assert.strictEqual(beta.out_of_stock_count, 1);
});

test('5. Low Stock & Out-of-Stock Products List', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/low-stock`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  const { data } = body;

  assert.strictEqual(data.length, 2); // Monitor (Low) & Desk (Out)
  const outOfStock = data.find(p => p.sku === 'SKU-O1');
  assert.strictEqual(outOfStock.status, 'OUT_OF_STOCK');
  assert.strictEqual(outOfStock.current_stock, 0);
  assert.strictEqual(outOfStock.deficit, 5);

  const lowStock = data.find(p => p.sku === 'SKU-L1');
  assert.strictEqual(lowStock.status, 'LOW_STOCK');
  assert.strictEqual(lowStock.current_stock, 5);
  assert.strictEqual(lowStock.deficit, 5);
});

test('6. Stock Movement Analytics & Timeline', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/movements?timeRange=30d`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  const { data } = body;

  assert.strictEqual(data.summary.stock_in, 50);
  assert.strictEqual(data.summary.stock_out, 10);
  assert.strictEqual(data.summary.net_change, 40);
  assert.strictEqual(data.summary.receipt_count, 1);
  assert.strictEqual(data.summary.delivery_count, 1);

  assert.ok(Array.isArray(data.movements));
  assert.strictEqual(data.movements.length, 2);
  assert.ok(Array.isArray(data.timeline));
});

test('7. Empty Database State Handling', async () => {
  const db = getDatabase(testDbPath);
  db.exec('DELETE FROM stock_ledger; DELETE FROM products; DELETE FROM warehouses;');

  const res = await fetch(`${baseUrl}/api/dashboard/summary`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.total_products, 0);
  assert.strictEqual(body.data.total_stock_quantity, 0);
  assert.strictEqual(body.data.total_warehouses, 0);
  assert.strictEqual(body.data.low_stock_items, 0);

  const invRes = await fetch(`${baseUrl}/api/dashboard/inventory`);
  assert.strictEqual(invRes.status, 200);
  const invBody = await invRes.json();
  assert.strictEqual(invBody.data.category_distribution.length, 0);
  assert.strictEqual(invBody.data.stock_by_warehouse.length, 0);

  const lowRes = await fetch(`${baseUrl}/api/dashboard/low-stock`);
  assert.strictEqual(lowRes.status, 200);
  const lowBody = await lowRes.json();
  assert.strictEqual(lowBody.data.length, 0);

  // Restore test database for other tests
  resetTestDatabase();
});
