const { getDatabase } = require('../config/database');

class Product {
  static findAll(customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT id, sku, name, category, current_stock, unit, created_at, updated_at
      FROM products
      ORDER BY name ASC
    `).all();
  }

  static findById(id, customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT id, sku, name, category, current_stock, unit, created_at, updated_at
      FROM products
      WHERE id = ?
    `).get(id);
  }

  static findBySku(sku, customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT id, sku, name, category, current_stock, unit, created_at, updated_at
      FROM products
      WHERE sku = ?
    `).get(sku);
  }

  static updateStock(id, newStock, customDb) {
    const db = customDb || getDatabase();
    const stmt = db.prepare(`
      UPDATE products
      SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(newStock, id);
  }
}

module.exports = Product;
