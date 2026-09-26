const app = require('./app');
const { getDatabase } = require('./config/database');

const PORT = process.env.PORT || 5000;

// Ensure database is initialized before serving requests
getDatabase();

const server = app.listen(PORT, () => {
  console.log(`[StockSense Backend] Server listening on port ${PORT}`);
});

module.exports = server;
