const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const productRoutes = require('./routes/productRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
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
app.use('/api/products', productRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/stock-ledger', stockLedgerRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error Handling Middleware
app.use(errorHandler);

module.exports = app;
