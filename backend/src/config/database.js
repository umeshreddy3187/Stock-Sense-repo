const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

let dbInstance = null;

function getDatabase(dbPath) {
  if (dbInstance && !dbPath) {
    return dbInstance;
  }

  const resolvedPath = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '../../data/stocksense.db');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(resolvedPath);

  // Enable foreign keys and WAL mode for reliability
  db.exec('PRAGMA foreign_keys = ON;');
  if (resolvedPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  initSchema(db);

  if (!dbPath) {
    dbInstance = db;
  }

  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
      unit TEXT NOT NULL DEFAULT 'units',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
      min_stock INTEGER NOT NULL DEFAULT 15 CHECK (min_stock >= 0),
      warehouse_id INTEGER DEFAULT 1 REFERENCES warehouses(id),
      unit TEXT NOT NULL DEFAULT 'units',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS delivery_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      destination_address TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PICKED', 'PACKED', 'VALIDATED', 'CANCELLED')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      validated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS delivery_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
      picked_quantity INTEGER NOT NULL DEFAULT 0,
      packed_quantity INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stock_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      movement_type TEXT NOT NULL CHECK (movement_type IN ('DELIVERY', 'RECEIPT', 'TRANSFER', 'ADJUSTMENT')),
      reference_type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      quantity_change INTEGER NOT NULL,
      quantity_before INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );
  `);

  // Column migration for backwards compatibility
  const productCols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
  if (!productCols.includes('min_stock')) {
    db.exec('ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 15;');
  }
  if (!productCols.includes('warehouse_id')) {
    db.exec('ALTER TABLE products ADD COLUMN warehouse_id INTEGER DEFAULT 1;');
  }

  seedDefaultData(db);
}

function seedDefaultData(db) {
  if (process.env.DISABLE_SEED === 'true') return;

  const checkWarehouse = db.prepare('SELECT COUNT(*) as count FROM warehouses').get();
  if (checkWarehouse.count < 3) {
    const insertWarehouse = db.prepare(`
      INSERT INTO warehouses (name, code, address)
      VALUES (?, ?, ?)
    `);
    if (checkWarehouse.count === 0) {
      insertWarehouse.run('Main Central Distribution', 'WH-MAIN-01', '100 Logistics Blvd, Suite 400');
    }
    const hasWh2 = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-WEST-02'").get();
    if (!hasWh2) {
      insertWarehouse.run('West Coast Logistics Hub', 'WH-WEST-02', '550 Harbor Way, Bay 12');
    }
    const hasWh3 = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-EAST-03'").get();
    if (!hasWh3) {
      insertWarehouse.run('East Coast Air Cargo Depot', 'WH-EAST-03', '1200 Terminal Rd, Cargo Bldg 3');
    }
  }

  const wh2 = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-WEST-02'").get();
  const wh3 = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-EAST-03'").get();
  if (wh2 && wh3) {
    db.prepare("UPDATE products SET warehouse_id = ?, min_stock = 10 WHERE sku IN ('PROD-003', 'PROD-004') AND (warehouse_id = 1 OR warehouse_id IS NULL)").run(wh2.id);
    db.prepare("UPDATE products SET warehouse_id = ?, min_stock = 20 WHERE sku IN ('PROD-005', 'PROD-006') AND (warehouse_id = 1 OR warehouse_id IS NULL)").run(wh3.id);
  }

  const checkCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (checkCount.count === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (sku, name, category, current_stock, min_stock, warehouse_id, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultProducts = [
      ['PROD-001', 'Ergonomic Mechanical Keyboard', 'Electronics', 50, 15, 1, 'units'],
      ['PROD-002', 'Ultra-Wide 34-inch Monitor', 'Electronics', 8, 10, 1, 'units'],
      ['PROD-003', 'Wireless Noise-Canceling Headphones', 'Audio', 40, 15, 2, 'units'],
      ['PROD-004', 'Adjustable Standing Desk Frame', 'Furniture', 0, 10, 2, 'units'],
      ['PROD-005', 'USB-C Universal Docking Station', 'Accessories', 80, 20, 3, 'units'],
      ['PROD-006', 'High-Precision Laser Mouse', 'Accessories', 5, 20, 3, 'units']
    ];

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const prod of defaultProducts) {
        const res = insertProduct.run(...prod);
        const prodId = Number(res.lastInsertRowid);
        const stock = prod[3];
        if (stock > 0) {
          db.prepare(`
            INSERT INTO stock_ledger (
              product_id, movement_type, reference_type, reference_id,
              quantity_change, quantity_before, quantity_after, timestamp, notes
            ) VALUES (?, 'RECEIPT', 'PURCHASE_RECEIPT', 101, ?, 0, ?, datetime('now', '-3 days'), 'Initial inventory stocking batch')
          `).run(prodId, stock, stock);
        }
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }
}

module.exports = {
  getDatabase,
  initSchema
};
