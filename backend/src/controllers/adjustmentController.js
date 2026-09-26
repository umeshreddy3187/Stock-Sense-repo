const { getDatabase } = require('../config/database');

exports.getAdjustments = (req, res, next) => {
  try {
    const db = getDatabase();
    const adjustments = db.prepare(`
      SELECT a.*, p.name as product_name, p.sku, p.unit, w.name as warehouse_name, w.code as warehouse_code
      FROM inventory_adjustments a
      JOIN products p ON a.product_id = p.id
      JOIN warehouses w ON a.warehouse_id = w.id
      ORDER BY a.created_at DESC
    `).all();

    res.json({ success: true, data: adjustments });
  } catch (err) {
    next(err);
  }
};

exports.createAdjustment = (req, res, next) => {
  try {
    const { product_id, warehouse_id, counted_quantity, reason } = req.body;
    if (!product_id || counted_quantity === undefined || !reason) {
      return res.status(400).json({ success: false, error: 'Product ID, counted quantity, and reason are required' });
    }

    const db = getDatabase();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const systemQuantity = product.current_stock;
    const counted = Math.max(0, parseInt(counted_quantity, 10));
    const variance = counted - systemQuantity;
    const whId = warehouse_id || product.warehouse_id || 1;
    const adjustmentNumber = 'ADJ-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    db.exec('BEGIN TRANSACTION;');
    try {
      // Insert adjustment record
      const adjRes = db.prepare(`
        INSERT INTO inventory_adjustments (
          adjustment_number, product_id, warehouse_id, system_quantity, counted_quantity, variance, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'APPLIED')
      `).run(adjustmentNumber, product.id, whId, systemQuantity, counted, variance, reason.trim());

      const adjustmentId = Number(adjRes.lastInsertRowid);

      // Update product current stock to physical counted quantity
      db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(counted, product.id);

      // Record in Stock Ledger
      db.prepare(`
        INSERT INTO stock_ledger (
          product_id, movement_type, reference_type, reference_id,
          quantity_change, quantity_before, quantity_after, timestamp, notes
        ) VALUES (?, 'ADJUSTMENT', 'INVENTORY_ADJUSTMENT', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(
        product.id,
        adjustmentId,
        variance,
        systemQuantity,
        counted,
        `Inventory physical reconciliation: ${reason.trim()} (${adjustmentNumber})`
      );

      db.exec('COMMIT;');
      res.status(201).json({
        success: true,
        message: 'Stock adjustment applied successfully',
        data: {
          id: adjustmentId,
          adjustment_number: adjustmentNumber,
          product_name: product.name,
          sku: product.sku,
          system_quantity: systemQuantity,
          counted_quantity: counted,
          variance,
          new_stock: counted
        }
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (err) {
    next(err);
  }
};
