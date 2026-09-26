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
