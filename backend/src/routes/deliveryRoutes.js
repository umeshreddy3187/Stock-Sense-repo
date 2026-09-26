const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

router.get('/', deliveryController.getDeliveries);
router.get('/:id', deliveryController.getDeliveryById);
router.post('/', deliveryController.createDelivery);
router.post('/:id/pick', deliveryController.pickDelivery);
router.post('/:id/pack', deliveryController.packDelivery);

module.exports = router;
