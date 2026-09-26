function errorHandler(err, req, res, next) {
  console.error('[Error]', err.stack || err.message || err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    details: err.details || null
  });
}

module.exports = errorHandler;
