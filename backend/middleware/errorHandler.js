class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Générateurs d'erreurs spécialisés (ex: new BadRequestError('Message'))
class BadRequestError extends AppError {
  constructor(message = 'Requête invalide', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}
class UnauthorizedError extends AppError {
  constructor(message = 'Non autorisé', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}
class ForbiddenError extends AppError {
  constructor(message = 'Accès refusé', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}
class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

// Middleware central
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.statusCode || 500;
  const payload = {
    message: err.message || 'Erreur interne.',
    code: err.code || 'INTERNAL_ERROR'
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  errorHandler
};
