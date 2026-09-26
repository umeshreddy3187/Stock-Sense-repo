const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Dashboard endpoints
router.get('/summary', dashboardController.getSummary);
router.get('/inventory', dashboardController.getInventory);
router.get('/warehouses', dashboardController.getWarehouses);
router.get('/movements', dashboardController.getMovements);
router.get('/low-stock', dashboardController.getLowStock);

module.exports = router;
