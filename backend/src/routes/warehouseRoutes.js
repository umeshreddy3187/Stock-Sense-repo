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

router.get('/:id', (req, res, next) => {
  try {
    const db = getDatabase();
    const warehouse = db.prepare(`
      SELECT id, name, code, address
      FROM warehouses
      WHERE id = ?
    `).get(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ success: false, error: 'Warehouse not found' });
    }
    res.json({ success: true, data: warehouse });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { name, code, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'Warehouse name and code are required' });
    }
    const db = getDatabase();
    const existing = db.prepare('SELECT id FROM warehouses WHERE code = ?').get(code.toUpperCase().trim());
    if (existing) {
      return res.status(400).json({ success: false, error: `Warehouse with code "${code}" already exists` });
    }
    const result = db.prepare(`
      INSERT INTO warehouses (name, code, address)
      VALUES (?, ?, ?)
    `).run(name.trim(), code.toUpperCase().trim(), address ? address.trim() : '');
    const newWh = {
      id: Number(result.lastInsertRowid),
      name: name.trim(),
      code: code.toUpperCase().trim(),
      address: address ? address.trim() : ''
    };
    res.status(201).json({ success: true, data: newWh });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
