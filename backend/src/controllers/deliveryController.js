const DeliveryOrder = require('../models/DeliveryOrder');
const Product = require('../models/Product');

exports.getDeliveries = (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      filter.status = status.toUpperCase();
    }
    const deliveries = DeliveryOrder.findAll(filter);
    res.json({
      success: true,
      data: deliveries
    });
  } catch (err) {
    next(err);
  }
};

exports.getDeliveryById = (req, res, next) => {
  try {
    const { id } = req.params;
    const order = DeliveryOrder.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Delivery order with ID ${id} not found`
      });
    }
    res.json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
};

exports.createDelivery = (req, res, next) => {
  try {
    const { customer_name, destination_address, notes, items } = req.body;

    // 1. Validate required customer_name
    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Customer name is required and cannot be empty'
      });
    }

    // 2. Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one product item is required for a delivery order'
      });
    }

    // 3. Validate each item
    const sanitizedItems = [];
    const productAggregates = new Map(); // track duplicate products in single order

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const productId = Number(item.product_id);
      const requestedQty = Number(item.requested_quantity);

      if (!productId || isNaN(productId)) {
        return res.status(400).json({
          success: false,
          error: `Item at index ${i} has invalid product_id`
        });
      }

      if (!Number.isInteger(requestedQty) || requestedQty <= 0) {
        return res.status(400).json({
          success: false,
          error: `Quantity for item at index ${i} must be a positive integer greater than zero`
        });
      }

      const product = Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product with ID ${productId} does not exist`
        });
      }

      const totalRequestedForProd = (productAggregates.get(productId) || 0) + requestedQty;
      if (totalRequestedForProd > product.current_stock) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for product "${product.name}" (SKU: ${product.sku}). Requested: ${totalRequestedForProd}, Available: ${product.current_stock}`
        });
      }

      productAggregates.set(productId, totalRequestedForProd);
      sanitizedItems.push({
        product_id: productId,
        requested_quantity: requestedQty
      });
    }

    const order = DeliveryOrder.create({
      customer_name: customer_name.trim(),
      destination_address: destination_address ? destination_address.trim() : null,
      notes: notes ? notes.trim() : null,
      items: sanitizedItems
    });

    res.status(201).json({
      success: true,
      message: 'Delivery order created successfully',
      data: order
    });
  } catch (err) {
    next(err);
  }
};

exports.pickDelivery = (req, res, next) => {
  try {
    const { id } = req.params;
    const order = DeliveryOrder.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Delivery order with ID ${id} not found`
      });
    }

    if (order.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: `Cannot pick order: current status is '${order.status}'. Order must be in 'DRAFT' status to pick.`
      });
    }

    // Auto-fill picked quantities to requested quantities if not customized
    const { item_picks } = req.body || {};
    const db = require('../config/database').getDatabase();

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const item of order.items) {
        let pickedQty = item.requested_quantity;
        if (item_picks && item_picks[item.id] !== undefined) {
          pickedQty = Number(item_picks[item.id]);
          if (!Number.isInteger(pickedQty) || pickedQty < 0 || pickedQty > item.requested_quantity) {
            db.exec('ROLLBACK;');
            return res.status(400).json({
              success: false,
              error: `Invalid picked quantity for item ${item.product_name}. Must be between 0 and requested ${item.requested_quantity}`
            });
          }
        }
        DeliveryOrder.updateItemQuantities(item.id, { picked_quantity: pickedQty }, db);
      }

      DeliveryOrder.updateStatus(id, 'PICKED', null, db);
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const updatedOrder = DeliveryOrder.findById(id);
    res.json({
      success: true,
      message: `Delivery order ${order.order_number} marked as PICKED`,
      data: updatedOrder
    });
  } catch (err) {
    next(err);
  }
};

exports.packDelivery = (req, res, next) => {
  try {
    const { id } = req.params;
    const order = DeliveryOrder.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Delivery order with ID ${id} not found`
      });
    }

    if (order.status === 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: `Cannot pack order: order is still in 'DRAFT' status. You must pick the items first.`
      });
    }

    if (order.status !== 'PICKED') {
      return res.status(400).json({
        success: false,
        error: `Cannot pack order: current status is '${order.status}'. Order must be in 'PICKED' status to pack.`
      });
    }

    const { item_packs } = req.body || {};
    const db = require('../config/database').getDatabase();

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const item of order.items) {
        let packedQty = item.picked_quantity > 0 ? item.picked_quantity : item.requested_quantity;
        if (item_packs && item_packs[item.id] !== undefined) {
          packedQty = Number(item_packs[item.id]);
          if (!Number.isInteger(packedQty) || packedQty < 0 || packedQty > item.requested_quantity) {
            db.exec('ROLLBACK;');
            return res.status(400).json({
              success: false,
              error: `Invalid packed quantity for item ${item.product_name}. Must be between 0 and ${item.requested_quantity}`
            });
          }
        }
        DeliveryOrder.updateItemQuantities(item.id, { packed_quantity: packedQty }, db);
      }

      DeliveryOrder.updateStatus(id, 'PACKED', null, db);
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const updatedOrder = DeliveryOrder.findById(id);
    res.json({
      success: true,
      message: `Delivery order ${order.order_number} marked as PACKED`,
      data: updatedOrder
    });
  } catch (err) {
    next(err);
  }
};
