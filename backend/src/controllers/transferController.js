const { getDatabase } = require('../config/database');

exports.getTransfers = (req, res, next) => {
  try {
    const db = getDatabase();
    const transfers = db.prepare(`
      SELECT t.*,
             sw.name as source_warehouse_name, sw.code as source_warehouse_code,
             dw.name as dest_warehouse_name, dw.code as dest_warehouse_code
      FROM internal_transfers t
      JOIN warehouses sw ON t.source_warehouse_id = sw.id
      JOIN warehouses dw ON t.destination_warehouse_id = dw.id
      ORDER BY t.created_at DESC
    `).all();

    const getItems = db.prepare(`
      SELECT ti.*, p.name as product_name, p.sku, p.unit
      FROM internal_transfer_items ti
      JOIN products p ON ti.product_id = p.id
      WHERE ti.transfer_id = ?
    `);

    const result = transfers.map(t => ({
      ...t,
      items: getItems.all(t.id)
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.createTransfer = (req, res, next) => {
  try {
    const { source_warehouse_id, destination_warehouse_id, notes, items } = req.body;
    if (!source_warehouse_id || !destination_warehouse_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Source warehouse, destination warehouse, and items are required' });
    }

    if (Number(source_warehouse_id) === Number(destination_warehouse_id)) {
      return res.status(400).json({ success: false, error: 'Source and destination warehouses cannot be the same' });
    }

    const db = getDatabase();
    const transferNumber = 'TRF-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    // Pre-check stock availability
    for (const it of items) {
      const prod = db.prepare('SELECT id, name, current_stock FROM products WHERE id = ?').get(it.product_id);
      if (!prod) {
        return res.status(400).json({ success: false, error: `Product ID ${it.product_id} not found` });
      }
      if (prod.current_stock < it.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for "${prod.name}". Available: ${prod.current_stock}, Requested: ${it.quantity}`
        });
      }
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      const transferRes = db.prepare(`
        INSERT INTO internal_transfers (transfer_number, source_warehouse_id, destination_warehouse_id, status, notes)
        VALUES (?, ?, ?, 'DRAFT', ?)
      `).run(transferNumber, source_warehouse_id, destination_warehouse_id, notes || '');

      const transferId = Number(transferRes.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO internal_transfer_items (transfer_id, product_id, quantity)
        VALUES (?, ?, ?)
      `);

      for (const item of items) {
        insertItem.run(transferId, item.product_id, item.quantity);
      }

      db.exec('COMMIT;');
      res.status(201).json({
        success: true,
        data: {
          id: transferId,
          transfer_number: transferNumber,
          status: 'DRAFT'
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

exports.dispatchTransfer = (req, res, next) => {
  try {
    const db = getDatabase();
    const transfer = db.prepare('SELECT * FROM internal_transfers WHERE id = ?').get(req.params.id);
    if (!transfer) return res.status(404).json({ success: false, error: 'Transfer not found' });

    if (transfer.status !== 'DRAFT') {
      return res.status(400).json({ success: false, error: `Cannot dispatch transfer in status ${transfer.status}` });
    }

    db.prepare("UPDATE internal_transfers SET status = 'IN_TRANSIT', dispatched_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(transfer.id);

    res.json({ success: true, data: { id: transfer.id, status: 'IN_TRANSIT' } });
  } catch (err) {
    next(err);
  }
};

exports.completeTransfer = (req, res, next) => {
  try {
    const db = getDatabase();
    const transfer = db.prepare(`
      SELECT t.*, sw.name as source_wh, dw.name as dest_wh
      FROM internal_transfers t
      JOIN warehouses sw ON t.source_warehouse_id = sw.id
      JOIN warehouses dw ON t.destination_warehouse_id = dw.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!transfer) return res.status(404).json({ success: false, error: 'Transfer not found' });
    if (transfer.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Transfer already completed' });
    }

    const items = db.prepare('SELECT * FROM internal_transfer_items WHERE transfer_id = ?').all(transfer.id);

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const item of items) {
        const prod = db.prepare('SELECT id, name, sku, current_stock FROM products WHERE id = ?').get(item.product_id);
        if (!prod) throw new Error(`Product ${item.product_id} not found`);

        // Record transfer in Stock Ledger
        db.prepare(`
          INSERT INTO stock_ledger (
            product_id, movement_type, reference_type, reference_id,
            quantity_change, quantity_before, quantity_after, timestamp, notes
          ) VALUES (?, 'TRANSFER', 'INTERNAL_TRANSFER', ?, 0, ?, ?, CURRENT_TIMESTAMP, ?)
        `).run(
          prod.id,
          transfer.id,
          prod.current_stock,
          prod.current_stock,
          `Relocated ${item.quantity} units from ${transfer.source_wh} to ${transfer.dest_wh} (${transfer.transfer_number})`
        );
      }

      db.prepare("UPDATE internal_transfers SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(transfer.id);

      db.exec('COMMIT;');
      res.json({ success: true, message: 'Transfer completed successfully', data: { id: transfer.id, status: 'COMPLETED' } });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (err) {
    next(err);
  }
};
