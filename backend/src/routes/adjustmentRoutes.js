const express = require('express');
const router = express.Router();
const adjustmentController = require('../controllers/adjustmentController');

router.get('/', adjustmentController.getAdjustments);
router.post('/', adjustmentController.createAdjustment);

module.exports = router;
