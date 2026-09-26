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

  static create({ sku, name, category, current_stock = 0, min_stock = 15, warehouse_id = 1, unit = 'units' }, customDb) {
    const db = customDb || getDatabase();
    const stmt = db.prepare(`
      INSERT INTO products (sku, name, category, current_stock, min_stock, warehouse_id, unit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      sku.toUpperCase().trim(),
      name.trim(),
      category.trim(),
      Math.max(0, parseInt(current_stock, 10) || 0),
      Math.max(0, parseInt(min_stock, 10) || 15),
      warehouse_id || 1,
      unit || 'units'
    );
    return this.findById(Number(res.lastInsertRowid), customDb);
  }

  static update(id, { name, category, min_stock, warehouse_id, unit }, customDb) {
    const db = customDb || getDatabase();
    const existing = this.findById(id, customDb);
    if (!existing) return null;

    db.prepare(`
      UPDATE products
      SET name = COALESCE(?, name),
          category = COALESCE(?, category),
          min_stock = COALESCE(?, min_stock),
          warehouse_id = COALESCE(?, warehouse_id),
          unit = COALESCE(?, unit),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : null,
      category !== undefined ? category.trim() : null,
      min_stock !== undefined ? parseInt(min_stock, 10) : null,
      warehouse_id !== undefined ? parseInt(warehouse_id, 10) : null,
      unit !== undefined ? unit.trim() : null,
      id
    );
    return this.findById(id, customDb);
  }

  static delete(id, customDb) {
    const db = customDb || getDatabase();
    return db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
}

module.exports = Product;
