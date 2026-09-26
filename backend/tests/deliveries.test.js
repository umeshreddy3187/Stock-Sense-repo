const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

// Set test database path before loading modules
const testDbPath = path.join(__dirname, '../data/test_stocksense.db');
process.env.DATABASE_PATH = testDbPath;

const { getDatabase } = require('../src/config/database');
const Product = require('../src/models/Product');
const StockLedger = require('../src/models/StockLedger');
const DeliveryOrder = require('../src/models/DeliveryOrder');
const app = require('../src/app');

// Helper to cleanup and reset database
function resetTestDatabase() {
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch (e) {
      // file might be locked, clean tables instead
    }
  }
  const db = getDatabase(testDbPath);
  db.exec(`
    DELETE FROM stock_ledger;
    DELETE FROM delivery_order_items;
    DELETE FROM delivery_orders;
    DELETE FROM products;
    DELETE FROM warehouses;
  `);

  // Seed standard products for testing
  const insertProduct = db.prepare(`
    INSERT INTO products (sku, name, category, current_stock, unit)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertProduct.run('TEST-001', 'Test Mechanical Keyboard', 'Electronics', 20, 'units');
  insertProduct.run('TEST-002', 'Test 4K Monitor', 'Electronics', 5, 'units');
  insertProduct.run('TEST-003', 'Test Ergonomic Mouse', 'Accessories', 10, 'units');

  return db;
}

// Helper to make API requests against test server
let server;
let baseUrl;

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
  if (server) {
    server.close();
  }
  if (fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); } catch (e) {}
  }
});

test('1. Delivery Order Creation - Success with Valid Fields', async () => {
  const db = getDatabase(testDbPath);
  const products = Product.findAll(db);
  const targetProduct = products.find(p => p.sku === 'TEST-001');

  const res = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Acme Global Logistics',
      destination_address: '742 Evergreen Terrace',
      notes: 'Fragile equipment - handle with care',
      items: [
        { product_id: targetProduct.id, requested_quantity: 4 }
      ]
    })
  });

  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.success, true);
  assert.ok(body.data.order_number.startsWith('DO-'));
  assert.strictEqual(body.data.customer_name, 'Acme Global Logistics');
  assert.strictEqual(body.data.status, 'DRAFT');
  assert.strictEqual(body.data.items.length, 1);
  assert.strictEqual(body.data.items[0].requested_quantity, 4);
  assert.strictEqual(body.data.items[0].picked_quantity, 0);
  assert.strictEqual(body.data.items[0].packed_quantity, 0);
});

test('2. Delivery Order Creation - Reject Missing Customer Name', async () => {
  const db = getDatabase(testDbPath);
  const products = Product.findAll(db);

  const res = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: '   ',
      items: [{ product_id: products[0].id, requested_quantity: 1 }]
    })
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.ok(body.error.toLowerCase().includes('customer name is required'));
});

test('3. Delivery Order Creation - Reject Empty Items', async () => {
  const res = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Valid Customer',
      items: []
    })
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.ok(body.error.toLowerCase().includes('at least one product item is required'));
});

test('4. Delivery Order Creation - Reject Zero or Negative Quantities', async () => {
  const db = getDatabase(testDbPath);
  const products = Product.findAll(db);

  // Test zero quantity
  const resZero = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Zero Qty Customer',
      items: [{ product_id: products[0].id, requested_quantity: 0 }]
    })
  });
  assert.strictEqual(resZero.status, 400);
  const zeroBody = await resZero.json();
  assert.ok(zeroBody.error.toLowerCase().includes('positive integer greater than zero'));

  // Test negative quantity
  const resNeg = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Negative Qty Customer',
      items: [{ product_id: products[0].id, requested_quantity: -5 }]
    })
  });
  assert.strictEqual(resNeg.status, 400);
  const negBody = await resNeg.json();
  assert.ok(negBody.error.toLowerCase().includes('positive integer greater than zero'));
});

test('5. Delivery Order Creation - Reject Quantity Greater Than Available Stock', async () => {
  const db = getDatabase(testDbPath);
  const monitor = Product.findBySku('TEST-002', db); // stock is 5

  const res = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Over-demand Buyer',
      items: [{ product_id: monitor.id, requested_quantity: 6 }] // 6 > 5
    })
  });

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.ok(body.error.toLowerCase().includes('insufficient stock'));
  assert.ok(body.error.includes('Requested: 6'));
  assert.ok(body.error.includes('Available: 5'));
});

test('6. Workflow Sequencing - Reject Invalid State Transitions', async () => {
  const db = getDatabase(testDbPath);
  const mouse = Product.findBySku('TEST-003', db);

  // Create order in DRAFT
  const createRes = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Workflow Test Co',
      items: [{ product_id: mouse.id, requested_quantity: 2 }]
    })
  });
  const created = (await createRes.json()).data;

  // Try packing before picking (should fail)
  const prematurePack = await fetch(`${baseUrl}/api/deliveries/${created.id}/pack`, {
    method: 'POST'
  });
  assert.strictEqual(prematurePack.status, 400);
  const packBody = await prematurePack.json();
  assert.ok(packBody.error.toLowerCase().includes('order must be picked first') || packBody.error.toLowerCase().includes('draft'));

  // Try validating before picking & packing (should fail)
  const prematureValidate = await fetch(`${baseUrl}/api/deliveries/${created.id}/validate`, {
    method: 'POST'
  });
  assert.strictEqual(prematureValidate.status, 400);
  const valBody = await prematureValidate.json();
  assert.ok(valBody.error.toLowerCase().includes('must pick and pack'));
});

test('7. Complete Workflow: Pick -> Pack -> Validate -> Real Stock Decrement & Stock Ledger Movement', async () => {
  const db = getDatabase(testDbPath);
  const keyboard = Product.findBySku('TEST-001', db);
  const initialStock = keyboard.current_stock; // 20

  // 1. Create Order
  const requestedQty = 3;
  const createRes = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Summit Enterprises',
      destination_address: '400 North Ridge Road',
      items: [{ product_id: keyboard.id, requested_quantity: requestedQty }]
    })
  });
  assert.strictEqual(createRes.status, 201);
  const order = (await createRes.json()).data;
  assert.strictEqual(order.status, 'DRAFT');

  // Verify stock has NOT decreased yet (remains in stock until validation)
  const productBeforeValidate = Product.findById(keyboard.id, db);
  assert.strictEqual(productBeforeValidate.current_stock, initialStock);

  // 2. Pick Order
  const pickRes = await fetch(`${baseUrl}/api/deliveries/${order.id}/pick`, {
    method: 'POST'
  });
  assert.strictEqual(pickRes.status, 200);
  const pickedOrder = (await pickRes.json()).data;
  assert.strictEqual(pickedOrder.status, 'PICKED');
  assert.strictEqual(pickedOrder.items[0].picked_quantity, requestedQty);

  // 3. Pack Order
  const packRes = await fetch(`${baseUrl}/api/deliveries/${order.id}/pack`, {
    method: 'POST'
  });
  assert.strictEqual(packRes.status, 200);
  const packedOrder = (await packRes.json()).data;
  assert.strictEqual(packedOrder.status, 'PACKED');
  assert.strictEqual(packedOrder.items[0].packed_quantity, requestedQty);

  // 4. Validate Order (triggers stock decrement and movement creation)
  const validateRes = await fetch(`${baseUrl}/api/deliveries/${order.id}/validate`, {
    method: 'POST'
  });
  assert.strictEqual(validateRes.status, 200);
  const validateBody = await validateRes.json();
  assert.strictEqual(validateBody.success, true);
  assert.strictEqual(validateBody.data.order.status, 'VALIDATED');
  assert.ok(validateBody.data.order.validated_at !== null);

  // 5. Database Assertions: Verify product stock in DB actually decreased!
  const productAfterValidate = Product.findById(keyboard.id, db);
  const expectedStock = initialStock - requestedQty;
  assert.strictEqual(productAfterValidate.current_stock, expectedStock, 'Stock in database must be decreased by requested_quantity');

  // 6. Database Assertions: Verify stock movement / ledger record was created!
  const movements = StockLedger.findByReference('DELIVERY_ORDER', order.id, db);
  assert.strictEqual(movements.length, 1);
  assert.strictEqual(movements[0].movement_type, 'DELIVERY');
  assert.strictEqual(movements[0].quantity_change, -requestedQty);
  assert.strictEqual(movements[0].quantity_before, initialStock);
  assert.strictEqual(movements[0].quantity_after, expectedStock);
  assert.ok(movements[0].notes.includes(order.order_number));

  // 7. Verify cannot validate again
  const revalidateRes = await fetch(`${baseUrl}/api/deliveries/${order.id}/validate`, {
    method: 'POST'
  });
  assert.strictEqual(revalidateRes.status, 400);
});

test('8. Insufficient Stock Rollback on Validation', async () => {
  const db = getDatabase(testDbPath);
  const monitor = Product.findBySku('TEST-002', db); // stock is 5

  // Create order for 5 monitors
  const createRes = await fetch(`${baseUrl}/api/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Direct Logistics',
      items: [{ product_id: monitor.id, requested_quantity: 5 }]
    })
  });
  const order = (await createRes.json()).data;

  // Pick and Pack
  await fetch(`${baseUrl}/api/deliveries/${order.id}/pick`, { method: 'POST' });
  await fetch(`${baseUrl}/api/deliveries/${order.id}/pack`, { method: 'POST' });

  // Simulate concurrent stock change in database (e.g. another adjustment lowered stock to 2)
  Product.updateStock(monitor.id, 2, db);

  // Attempt validate -> should fail with 409 Conflict due to insufficient stock
  const valRes = await fetch(`${baseUrl}/api/deliveries/${order.id}/validate`, {
    method: 'POST'
  });
  assert.strictEqual(valRes.status, 409);
  const valBody = await valRes.json();
  assert.strictEqual(valBody.success, false);
  assert.ok(valBody.error.toLowerCase().includes('insufficient stock'));

  // Ensure stock was NOT decremented further into negative numbers
  const finalProd = Product.findById(monitor.id, db);
  assert.strictEqual(finalProd.current_stock, 2);

  // Ensure order remained PACKED and not falsely marked VALIDATED
  const finalOrder = DeliveryOrder.findById(order.id, db);
  assert.strictEqual(finalOrder.status, 'PACKED');
});
