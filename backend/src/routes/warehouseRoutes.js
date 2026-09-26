const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

router.get('/', (req, res, next) => {
  try {
    const db = getDatabase();
    const warehouses = db.prepare(`
      SELECT id, name, code, address
      FROM warehouses
      ORDER BY id ASC
    `).all();
    res.json({
      success: true,
      data: warehouses
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
