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

  seedDefaultData(db);
}

function seedDefaultData(db) {
  const checkCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (checkCount.count === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (sku, name, category, current_stock, unit)
      VALUES (?, ?, ?, ?, ?)
    `);

    const defaultProducts = [
      ['PROD-001', 'Ergonomic Mechanical Keyboard', 'Electronics', 50, 'units'],
      ['PROD-002', 'Ultra-Wide 34-inch Monitor', 'Electronics', 25, 'units'],
      ['PROD-003', 'Wireless Noise-Canceling Headphones', 'Audio', 40, 'units'],
      ['PROD-004', 'Adjustable Standing Desk Frame', 'Furniture', 15, 'units'],
      ['PROD-005', 'USB-C Universal Docking Station', 'Accessories', 80, 'units'],
      ['PROD-006', 'High-Precision Laser Mouse', 'Accessories', 100, 'units']
    ];

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const prod of defaultProducts) {
        insertProduct.run(...prod);
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  const checkWarehouse = db.prepare('SELECT COUNT(*) as count FROM warehouses').get();
  if (checkWarehouse.count === 0) {
    const insertWarehouse = db.prepare(`
      INSERT INTO warehouses (name, code, address)
      VALUES (?, ?, ?)
    `);
    insertWarehouse.run('Main Central Distribution', 'WH-MAIN-01', '100 Logistics Blvd, Suite 400');
  }
}

module.exports = {
  getDatabase,
  initSchema
};
