const { getDatabase } = require('../config/database');

/**
 * Helper to build date range SQL condition
 */
function buildDateCondition(timeRange, startDate, endDate, dateCol = 'timestamp') {
  if (startDate && endDate) {
    return {
      sql: ` AND ${dateCol} BETWEEN ? AND ? `,
      params: [`${startDate} 00:00:00`, `${endDate} 23:59:59`]
    };
  }

  if (timeRange === 'today') {
    return {
      sql: ` AND date(${dateCol}) = date('now') `,
      params: []
    };
  }

  if (timeRange === '7d') {
    return {
      sql: ` AND ${dateCol} >= datetime('now', '-7 days') `,
      params: []
    };
  }

  if (timeRange === '30d') {
    return {
      sql: ` AND ${dateCol} >= datetime('now', '-30 days') `,
      params: []
    };
  }

  // default / 'all'
  return {
    sql: '',
    params: []
  };
}

/**
 * GET /api/dashboard/summary
 * KPI summary metrics
 */
exports.getSummary = (req, res, next) => {
  try {
    const db = getDatabase();
    const { warehouseId, category, timeRange, startDate, endDate } = req.query;

    // Product stock filters
    let prodFilterSql = ' WHERE 1=1 ';
    const prodParams = [];

    if (warehouseId) {
      prodFilterSql += ' AND warehouse_id = ? ';
      prodParams.push(Number(warehouseId));
    }

    if (category && category !== 'ALL') {
      prodFilterSql += ' AND category = ? ';
      prodParams.push(category);
    }

    // Query 1: Product & Stock KPIs
    const productStats = db.prepare(`
      SELECT 
        COUNT(id) as total_products,
        COALESCE(SUM(current_stock), 0) as total_stock,
        COUNT(CASE WHEN current_stock > 0 AND current_stock <= COALESCE(min_stock, 15) THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_items,
        COUNT(CASE WHEN current_stock > COALESCE(min_stock, 15) THEN 1 END) as healthy_stock_items
      FROM products
      ${prodFilterSql}
    `).get(...prodParams);

    // Query 2: Warehouse Count
    let whCountQuery = 'SELECT COUNT(id) as count FROM warehouses';
    let whCountParams = [];
    if (warehouseId) {
      whCountQuery += ' WHERE id = ?';
      whCountParams.push(Number(warehouseId));
    }
    const warehouseCount = db.prepare(whCountQuery).get(...whCountParams);

    // Query 3: Movements Count in time range
    const dateCond = buildDateCondition(timeRange, startDate, endDate, 'sl.timestamp');
    let movementFilterSql = ' WHERE 1=1 ' + dateCond.sql;
    const movementParams = [...dateCond.params];

    if (warehouseId) {
      movementFilterSql += ' AND p.warehouse_id = ? ';
      movementParams.push(Number(warehouseId));
    }
    if (category && category !== 'ALL') {
      movementFilterSql += ' AND p.category = ? ';
      movementParams.push(category);
    }

    const movementStats = db.prepare(`
      SELECT COUNT(sl.id) as count
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      ${movementFilterSql}
    `).get(...movementParams);

    // Query 4: Total Delivery Orders count
    const deliveryStats = db.prepare(`
      SELECT 
        COUNT(id) as total_orders,
        COUNT(CASE WHEN status = 'VALIDATED' THEN 1 END) as fulfilled_orders,
        COUNT(CASE WHEN status != 'VALIDATED' AND status != 'CANCELLED' THEN 1 END) as pending_orders
      FROM delivery_orders
    `).get();

    res.json({
      success: true,
      data: {
        total_products: productStats.total_products || 0,
        total_stock_quantity: productStats.total_stock || 0,
        total_warehouses: warehouseCount.count || 0,
        low_stock_items: productStats.low_stock_items || 0,
        out_of_stock_items: productStats.out_of_stock_items || 0,
        healthy_stock_items: productStats.healthy_stock_items || 0,
        recent_movements_count: movementStats.count || 0,
        delivery_orders_summary: deliveryStats
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/inventory
 * Inventory distribution by Category & Warehouse
 */
exports.getInventory = (req, res, next) => {
  try {
    const db = getDatabase();
    const { warehouseId } = req.query;

    let prodFilterSql = ' WHERE 1=1 ';
    const params = [];

    if (warehouseId) {
      prodFilterSql += ' AND p.warehouse_id = ? ';
      params.push(Number(warehouseId));
    }

    // Category breakdown
    const categories = db.prepare(`
      SELECT 
        p.category,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.current_stock), 0) as total_stock
      FROM products p
      ${prodFilterSql}
      GROUP BY p.category
      ORDER BY total_stock DESC
    `).all(...params);

    const totalStock = categories.reduce((sum, c) => sum + Number(c.total_stock), 0);
    const categoryDistribution = categories.map(cat => ({
      category: cat.category,
      product_count: cat.product_count,
      total_stock: cat.total_stock,
      percentage: totalStock > 0 ? Number(((cat.total_stock / totalStock) * 100).toFixed(1)) : 0
    }));

    // Stock by warehouse
    const stockByWarehouse = db.prepare(`
      SELECT 
        w.id as warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.current_stock), 0) as total_stock
      FROM warehouses w
      LEFT JOIN products p ON w.id = p.warehouse_id
      GROUP BY w.id
      ORDER BY w.id ASC
    `).all();

    // Stock health distribution
    const healthStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN p.current_stock > COALESCE(p.min_stock, 15) THEN 1 END) as healthy,
        COUNT(CASE WHEN p.current_stock > 0 AND p.current_stock <= COALESCE(p.min_stock, 15) THEN 1 END) as low_stock,
        COUNT(CASE WHEN p.current_stock = 0 THEN 1 END) as out_of_stock
      FROM products p
      ${prodFilterSql}
    `).get(...params);

    res.json({
      success: true,
      data: {
        category_distribution: categoryDistribution,
        stock_by_warehouse: stockByWarehouse,
        status_breakdown: {
          healthy: healthStats.healthy || 0,
          low_stock: healthStats.low_stock || 0,
          out_of_stock: healthStats.out_of_stock || 0
        },
        total_inventory_units: totalStock
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/warehouses
 * Detailed warehouse statistics
 */
exports.getWarehouses = (req, res, next) => {
  try {
    const db = getDatabase();
    const { warehouseId } = req.query;

    let filterSql = '';
    const params = [];
    if (warehouseId) {
      filterSql = ' WHERE w.id = ? ';
      params.push(Number(warehouseId));
    }

    const warehouses = db.prepare(`
      SELECT 
        w.id,
        w.name,
        w.code,
        w.address,
        COUNT(p.id) as product_count,
        COALESCE(SUM(p.current_stock), 0) as total_quantity,
        COUNT(CASE WHEN p.current_stock > 0 AND p.current_stock <= COALESCE(p.min_stock, 15) THEN 1 END) as low_stock_count,
        COUNT(CASE WHEN p.current_stock = 0 THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN p.current_stock > COALESCE(p.min_stock, 15) THEN 1 END) as healthy_count
      FROM warehouses w
      LEFT JOIN products p ON w.id = p.warehouse_id
      ${filterSql}
      GROUP BY w.id
      ORDER BY w.id ASC
    `).all(...params);

    res.json({
      success: true,
      data: warehouses
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/movements
 * Stock movement analytics and activity table
 */
exports.getMovements = (req, res, next) => {
  try {
    const db = getDatabase();
    const {
      timeRange = '30d',
      startDate,
      endDate,
      warehouseId,
      movementType,
      productId,
      limit = 15,
      offset = 0
    } = req.query;

    const dateCond = buildDateCondition(timeRange, startDate, endDate, 'sl.timestamp');
    let filterSql = ' WHERE 1=1 ' + dateCond.sql;
    const filterParams = [...dateCond.params];

    if (warehouseId) {
      filterSql += ' AND p.warehouse_id = ? ';
      filterParams.push(Number(warehouseId));
    }

    if (movementType && movementType !== 'ALL') {
      filterSql += ' AND sl.movement_type = ? ';
      filterParams.push(movementType);
    }

    if (productId) {
      filterSql += ' AND sl.product_id = ? ';
      filterParams.push(Number(productId));
    }

    // 1. Overall Movement Summary Totals
    const summary = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN sl.quantity_change > 0 THEN sl.quantity_change ELSE 0 END), 0) as total_in,
        COALESCE(SUM(CASE WHEN sl.quantity_change < 0 THEN ABS(sl.quantity_change) ELSE 0 END), 0) as total_out,
        COUNT(CASE WHEN sl.movement_type = 'RECEIPT' THEN 1 END) as receipt_count,
        COUNT(CASE WHEN sl.movement_type = 'DELIVERY' THEN 1 END) as delivery_count,
        COUNT(CASE WHEN sl.movement_type = 'TRANSFER' THEN 1 END) as transfer_count,
        COUNT(CASE WHEN sl.movement_type = 'ADJUSTMENT' THEN 1 END) as adjustment_count,
        COALESCE(SUM(sl.quantity_change), 0) as net_change
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      ${filterSql}
    `).get(...filterParams);

    // 2. Timeline aggregation for charting (grouped by date)
    const timeline = db.prepare(`
      SELECT 
        date(sl.timestamp) as date_label,
        COALESCE(SUM(CASE WHEN sl.quantity_change > 0 THEN sl.quantity_change ELSE 0 END), 0) as stock_in,
        COALESCE(SUM(CASE WHEN sl.quantity_change < 0 THEN ABS(sl.quantity_change) ELSE 0 END), 0) as stock_out,
        COALESCE(SUM(sl.quantity_change), 0) as net_change,
        COUNT(sl.id) as movement_count
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      ${filterSql}
      GROUP BY date(sl.timestamp)
      ORDER BY date_label ASC
      LIMIT 30
    `).all(...filterParams);

    // 3. Paginated Recent Movements List
    const movementsCount = db.prepare(`
      SELECT COUNT(sl.id) as total
      FROM stock_ledger sl
      LEFT JOIN products p ON sl.product_id = p.id
      ${filterSql}
    `).get(...filterParams);

    const safeLimit = Math.min(Math.max(Number(limit) || 15, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    const movements = db.prepare(`
      SELECT 
        sl.id,
        sl.product_id,
        p.sku as product_sku,
        p.name as product_name,
        p.unit as product_unit,
        w.name as warehouse_name,
        w.code as warehouse_code,
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
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      ${filterSql}
      ORDER BY sl.id DESC
      LIMIT ? OFFSET ?
    `).all(...filterParams, safeLimit, safeOffset);

    res.json({
      success: true,
      data: {
        summary: {
          stock_in: summary.total_in || 0,
          stock_out: summary.total_out || 0,
          receipt_count: summary.receipt_count || 0,
          delivery_count: summary.delivery_count || 0,
          transfer_count: summary.transfer_count || 0,
          adjustment_count: summary.adjustment_count || 0,
          net_change: summary.net_change || 0
        },
        timeline,
        movements,
        pagination: {
          total: movementsCount.total || 0,
          limit: safeLimit,
          offset: safeOffset
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/dashboard/low-stock
 * Low stock and out-of-stock items requiring attention
 */
exports.getLowStock = (req, res, next) => {
  try {
    const db = getDatabase();
    const { warehouseId, category, status } = req.query;

    let filterSql = ' WHERE p.current_stock <= COALESCE(p.min_stock, 15) ';
    const params = [];

    if (warehouseId) {
      filterSql += ' AND p.warehouse_id = ? ';
      params.push(Number(warehouseId));
    }

    if (category && category !== 'ALL') {
      filterSql += ' AND p.category = ? ';
      params.push(category);
    }

    if (status === 'OUT_OF_STOCK') {
      filterSql += ' AND p.current_stock = 0 ';
    } else if (status === 'LOW_STOCK') {
      filterSql += ' AND p.current_stock > 0 ';
    }

    const items = db.prepare(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.category,
        p.current_stock,
        COALESCE(p.min_stock, 15) as min_stock,
        p.unit,
        p.warehouse_id,
        w.name as warehouse_name,
        w.code as warehouse_code,
        CASE 
          WHEN p.current_stock = 0 THEN 'OUT_OF_STOCK'
          ELSE 'LOW_STOCK'
        END as status,
        (COALESCE(p.min_stock, 15) - p.current_stock) as deficit
      FROM products p
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      ${filterSql}
      ORDER BY p.current_stock ASC, deficit DESC
    `).all(...params);

    res.json({
      success: true,
      data: items
    });
  } catch (err) {
    next(err);
  }
};
