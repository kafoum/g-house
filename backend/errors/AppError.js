/**
 * Base Application Error class
 */
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request Error
 */
class BadRequestError extends AppError {
  constructor(message = 'Requête invalide.', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized Error
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Authentification requise.', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden Error
 */
class ForbiddenError extends AppError {
  constructor(message = 'Accès interdit.', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found Error
 */
class NotFoundError extends AppError {
  constructor(message = 'Ressource non trouvée.', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict Error
 */
class ConflictError extends AppError {
  constructor(message = 'Conflit de ressource.', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * 422 Validation Error
 */
class ValidationError extends AppError {
  constructor(message = 'Erreur de validation.', code = 'VALIDATION_ERROR') {
    super(message, 422, code);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalServerError extends AppError {
  constructor(message = 'Erreur interne du serveur.', code = 'INTERNAL_ERROR') {
    super(message, 500, code);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError
};
