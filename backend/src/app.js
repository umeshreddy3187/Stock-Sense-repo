const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const transferRoutes = require('./routes/transferRoutes');
const adjustmentRoutes = require('./routes/adjustmentRoutes');
const stockLedgerRoutes = require('./routes/stockLedgerRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// API health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'StockSense Backend',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/stock-ledger', stockLedgerRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
