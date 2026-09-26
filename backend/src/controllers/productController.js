const Product = require('../models/Product');

exports.getProducts = (req, res, next) => {
  try {
    const products = Product.findAll();
    res.json({
      success: true,
      data: products
    });
  } catch (err) {
    next(err);
  }
};

exports.getProductById = (req, res, next) => {
  try {
    const product = Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    res.json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
};

exports.createProduct = (req, res, next) => {
  try {
    const { sku, name, category, current_stock, min_stock, warehouse_id, unit } = req.body;
    if (!sku || !name || !category) {
      return res.status(400).json({ success: false, error: 'SKU, name, and category are required' });
    }

    const existing = Product.findBySku(sku);
    if (existing) {
      return res.status(400).json({ success: false, error: `Product with SKU "${sku}" already exists` });
    }

    const newProd = Product.create({ sku, name, category, current_stock, min_stock, warehouse_id, unit });
    res.status(201).json({ success: true, data: newProd });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = (req, res, next) => {
  try {
    const updated = Product.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

exports.deleteProduct = (req, res, next) => {
  try {
    const existing = Product.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    Product.delete(req.params.id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
};
