const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

router.get('/', transferController.getTransfers);
router.post('/', transferController.createTransfer);
router.post('/:id/dispatch', transferController.dispatchTransfer);
router.post('/:id/complete', transferController.completeTransfer);

module.exports = router;
