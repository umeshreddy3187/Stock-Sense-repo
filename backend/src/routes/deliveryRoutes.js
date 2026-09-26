const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

router.get('/', deliveryController.getDeliveries);
router.get('/:id', deliveryController.getDeliveryById);
router.post('/', deliveryController.createDelivery);

module.exports = router;
