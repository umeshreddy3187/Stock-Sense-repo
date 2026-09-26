const StockLedger = require('../models/StockLedger');

exports.getLedger = (req, res, next) => {
  try {
    const { productId, referenceType, referenceId } = req.query;
    let movements;
    if (productId) {
      movements = StockLedger.findByProductId(productId);
    } else if (referenceType && referenceId) {
      movements = StockLedger.findByReference(referenceType, referenceId);
    } else {
      movements = StockLedger.findAll();
    }
    res.json({
      success: true,
      data: movements
    });
  } catch (err) {
    next(err);
  }
};
