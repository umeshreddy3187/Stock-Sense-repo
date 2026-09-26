const { getDatabase } = require('../config/database');

exports.getReceipts = (req, res, next) => {
  try {
    const db = getDatabase();
    const receipts = db.prepare(`
      SELECT r.*, w.name as warehouse_name, w.code as warehouse_code
      FROM purchase_receipts r
      LEFT JOIN warehouses w ON r.warehouse_id = w.id
      ORDER BY r.created_at DESC
    `).all();

    const getItems = db.prepare(`
      SELECT ri.*, p.name as product_name, p.sku, p.unit
      FROM purchase_receipt_items ri
      JOIN products p ON ri.product_id = p.id
      WHERE ri.receipt_id = ?
    `);

    const result = receipts.map(r => ({
      ...r,
      items: getItems.all(r.id)
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getReceiptById = (req, res, next) => {
  try {
    const db = getDatabase();
    const receipt = db.prepare(`
      SELECT r.*, w.name as warehouse_name, w.code as warehouse_code
      FROM purchase_receipts r
      LEFT JOIN warehouses w ON r.warehouse_id = w.id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!receipt) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    const items = db.prepare(`
      SELECT ri.*, p.name as product_name, p.sku, p.unit
      FROM purchase_receipt_items ri
      JOIN products p ON ri.product_id = p.id
      WHERE ri.receipt_id = ?
    `).all(receipt.id);

    res.json({ success: true, data: { ...receipt, items } });
  } catch (err) {
    next(err);
  }
};

exports.createReceipt = (req, res, next) => {
  try {
    const { supplier_name, supplier_ref, warehouse_id, notes, items } = req.body;
    if (!supplier_name || !warehouse_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Supplier name, warehouse, and at least one item are required' });
    }

    const db = getDatabase();
    const receiptNumber = 'REC-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    let totalAmount = 0;
    items.forEach(it => {
      totalAmount += (it.quantity_ordered || 0) * (it.unit_cost || 0);
    });

    db.exec('BEGIN TRANSACTION;');
    try {
      const receiptRes = db.prepare(`
        INSERT INTO purchase_receipts (receipt_number, supplier_name, supplier_ref, warehouse_id, status, total_amount, notes)
        VALUES (?, ?, ?, ?, 'DRAFT', ?, ?)
      `).run(receiptNumber, supplier_name.trim(), supplier_ref || '', warehouse_id, totalAmount, notes || '');

      const receiptId = Number(receiptRes.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO purchase_receipt_items (receipt_id, product_id, quantity_ordered, quantity_received, unit_cost)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(receiptId, item.product_id, item.quantity_ordered, item.quantity_received || 0, item.unit_cost || 0);
      }

      db.exec('COMMIT;');
      res.status(201).json({
        success: true,
        data: {
          id: receiptId,
          receipt_number: receiptNumber,
          supplier_name,
          status: 'DRAFT',
          total_amount: totalAmount
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

exports.receiveReceipt = (req, res, next) => {
  try {
    const db = getDatabase();
    const receiptId = req.params.id;

    const receipt = db.prepare('SELECT * FROM purchase_receipts WHERE id = ?').get(receiptId);
    if (!receipt) {
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }

    if (receipt.status === 'RECEIVED') {
      return res.status(400).json({ success: false, error: 'Receipt has already been received and stocked in' });
    }

    const items = db.prepare('SELECT * FROM purchase_receipt_items WHERE receipt_id = ?').all(receiptId);
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Receipt has no items to stock in' });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const item of items) {
        const product = db.prepare('SELECT id, name, sku, current_stock FROM products WHERE id = ?').get(item.product_id);
        if (!product) throw new Error(`Product ID ${item.product_id} not found`);

        const qtyToAdd = item.quantity_received > 0 ? item.quantity_received : item.quantity_ordered;
        const newStock = product.current_stock + qtyToAdd;

        // Update product stock
        db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newStock, product.id);

        // Update item received quantity
        db.prepare('UPDATE purchase_receipt_items SET quantity_received = ? WHERE id = ?')
          .run(qtyToAdd, item.id);

        // Log to Stock Ledger
        db.prepare(`
          INSERT INTO stock_ledger (
            product_id, movement_type, reference_type, reference_id,
            quantity_change, quantity_before, quantity_after, timestamp, notes
          ) VALUES (?, 'RECEIPT', 'PURCHASE_RECEIPT', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `).run(
          product.id,
          receipt.id,
          qtyToAdd,
          product.current_stock,
          newStock,
          `Inward receipt from ${receipt.supplier_name} (${receipt.receipt_number})`
        );
      }

      db.prepare("UPDATE purchase_receipts SET status = 'RECEIVED', received_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(receipt.id);

      db.exec('COMMIT;');
      res.json({
        success: true,
        message: 'Receipt processed and product stock increased successfully',
        data: { id: receipt.id, status: 'RECEIVED' }
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (err) {
    next(err);
  }
};
