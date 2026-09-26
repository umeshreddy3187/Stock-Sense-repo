const { getDatabase } = require('../config/database');

class Product {
  static findAll(customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT 
        p.id, p.sku, p.name, p.category, p.current_stock, 
        COALESCE(p.min_stock, 15) as min_stock, 
        p.warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        p.unit, p.created_at, p.updated_at
      FROM products p
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      ORDER BY p.name ASC
    `).all();
  }

  static findById(id, customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT 
        p.id, p.sku, p.name, p.category, p.current_stock, 
        COALESCE(p.min_stock, 15) as min_stock, 
        p.warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        p.unit, p.created_at, p.updated_at
      FROM products p
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      WHERE p.id = ?
    `).get(id);
  }

  static findBySku(sku, customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT 
        p.id, p.sku, p.name, p.category, p.current_stock, 
        COALESCE(p.min_stock, 15) as min_stock, 
        p.warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        p.unit, p.created_at, p.updated_at
      FROM products p
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      WHERE p.sku = ?
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
