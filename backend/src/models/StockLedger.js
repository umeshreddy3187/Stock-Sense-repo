const { getDatabase } = require('../config/database');

class StockLedger {
  static createMovement({ product_id, movement_type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, notes }, customDb) {
    const db = customDb || getDatabase();
    const stmt = db.prepare(`
      INSERT INTO stock_ledger (
        product_id, movement_type, reference_type, reference_id,
        quantity_change, quantity_before, quantity_after, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_before,
      quantity_after,
      notes || null
    );
    return {
      id: Number(result.lastInsertRowid),
      product_id,
      movement_type,
      reference_type,
      reference_id,
      quantity_change,
      quantity_before,
      quantity_after,
      notes
    };
  }

  static findAll(customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT 
        sl.id,
        sl.product_id,
        p.sku as product_sku,
        p.name as product_name,
        sl.movement_type,
        sl.reference_type,
        sl.reference_id,
        sl.quantity_change,
        sl.quantity_before,
        sl.quantity_after,
        sl.timestamp,
        sl.notes
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      ORDER BY sl.id DESC
    `).all();
  }

  static findByProductId(productId, customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT 
        sl.id,
        sl.product_id,
        p.sku as product_sku,
        p.name as product_name,
        sl.movement_type,
        sl.reference_type,
        sl.reference_id,
        sl.quantity_change,
        sl.quantity_before,
        sl.quantity_after,
        sl.timestamp,
        sl.notes
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      WHERE sl.product_id = ?
      ORDER BY sl.id DESC
    `).all(productId);
  }

  static findByReference(referenceType, referenceId, customDb) {
    const db = customDb || getDatabase();
    return db.prepare(`
      SELECT 
        sl.id,
        sl.product_id,
        p.sku as product_sku,
        p.name as product_name,
        sl.movement_type,
        sl.reference_type,
        sl.reference_id,
        sl.quantity_change,
        sl.quantity_before,
        sl.quantity_after,
        sl.timestamp,
        sl.notes
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      WHERE sl.reference_type = ? AND sl.reference_id = ?
      ORDER BY sl.id DESC
    `).all(referenceType, referenceId);
  }
}

module.exports = StockLedger;
