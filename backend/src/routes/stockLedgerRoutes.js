const express = require('express');
const router = express.Router();
const stockLedgerController = require('../controllers/stockLedgerController');

router.get('/', stockLedgerController.getLedger);

module.exports = router;
