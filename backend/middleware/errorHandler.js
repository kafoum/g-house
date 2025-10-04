/**
 * Global error handling middleware
 * Catches all errors and returns a consistent response format
 */
module.exports = (err, req, res, _next) => {
  console.error('[ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method
  });

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Erreur interne du serveur.';
  const code = err.code || 'INTERNAL_ERROR';

  // Don't expose stack trace in production
  const response = {
    message,
    code
  };

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
