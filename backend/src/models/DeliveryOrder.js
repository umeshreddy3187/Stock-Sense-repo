const { getDatabase } = require('../config/database');

class DeliveryOrder {
  static generateOrderNumber(customDb) {
    const db = customDb || getDatabase();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `DO-${today}-`;
    const countRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM delivery_orders 
      WHERE order_number LIKE ?
    `).get(`${prefix}%`);
    const nextSeq = String(Number(countRow.count) + 1).padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  static create({ customer_name, destination_address, notes, items }, customDb) {
    const db = customDb || getDatabase();
    const orderNumber = this.generateOrderNumber(db);

    db.exec('BEGIN TRANSACTION;');
    try {
      const orderStmt = db.prepare(`
        INSERT INTO delivery_orders (
          order_number, customer_name, destination_address, notes, status
        ) VALUES (?, ?, ?, ?, 'DRAFT')
      `);
      const orderResult = orderStmt.run(
        orderNumber,
        customer_name,
        destination_address || null,
        notes || null
      );
      const deliveryOrderId = Number(orderResult.lastInsertRowid);

      const itemStmt = db.prepare(`
        INSERT INTO delivery_order_items (
          delivery_order_id, product_id, requested_quantity, picked_quantity, packed_quantity
        ) VALUES (?, ?, ?, 0, 0)
      `);

      for (const item of items) {
        itemStmt.run(deliveryOrderId, item.product_id, item.requested_quantity);
      }

      db.exec('COMMIT;');
      return this.findById(deliveryOrderId, db);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  static findAll(filter = {}, customDb) {
    const db = customDb || getDatabase();
    let query = `
      SELECT 
        d.id,
        d.order_number,
        d.customer_name,
        d.destination_address,
        d.status,
        d.notes,
        d.created_at,
        d.updated_at,
        d.validated_at,
        COUNT(doi.id) as total_items,
        COALESCE(SUM(doi.requested_quantity), 0) as total_requested_quantity
      FROM delivery_orders d
      LEFT JOIN delivery_order_items doi ON d.id = doi.delivery_order_id
    `;
    const params = [];

    if (filter.status) {
      query += ` WHERE d.status = ? `;
      params.push(filter.status);
    }

    query += ` GROUP BY d.id ORDER BY d.id DESC `;

    const orders = db.prepare(query).all(...params);
    return orders;
  }

  static findById(id, customDb) {
    const db = customDb || getDatabase();
    const order = db.prepare(`
      SELECT 
        id, order_number, customer_name, destination_address, 
        status, notes, created_at, updated_at, validated_at
      FROM delivery_orders
      WHERE id = ?
    `).get(id);

    if (!order) return null;

    const items = db.prepare(`
      SELECT 
        doi.id,
        doi.delivery_order_id,
        doi.product_id,
        doi.requested_quantity,
        doi.picked_quantity,
        doi.packed_quantity,
        p.sku as product_sku,
        p.name as product_name,
        p.category as product_category,
        p.current_stock as current_available_stock,
        p.unit as product_unit
      FROM delivery_order_items doi
      JOIN products p ON doi.product_id = p.id
      WHERE doi.delivery_order_id = ?
    `).all(id);

    return {
      ...order,
      items
    };
  }

  static updateStatus(id, status, validatedAt = null, customDb) {
    const db = customDb || getDatabase();
    const stmt = db.prepare(`
      UPDATE delivery_orders
      SET status = ?, 
          validated_at = COALESCE(?, validated_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, validatedAt, id);
    return this.findById(id, db);
  }

  static updateItemQuantities(itemId, { picked_quantity, packed_quantity }, customDb) {
    const db = customDb || getDatabase();
    const updates = [];
    const params = [];

    if (picked_quantity !== undefined) {
      updates.push('picked_quantity = ?');
      params.push(picked_quantity);
    }
    if (packed_quantity !== undefined) {
      updates.push('packed_quantity = ?');
      params.push(packed_quantity);
    }

    if (updates.length === 0) return;
    params.push(itemId);

    const stmt = db.prepare(`
      UPDATE delivery_order_items
      SET ${updates.join(', ')}
      WHERE id = ?
    `);
    return stmt.run(...params);
  }
}

module.exports = DeliveryOrder;
