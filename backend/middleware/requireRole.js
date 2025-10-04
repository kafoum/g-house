const { ForbiddenError } = require('../errors/AppError');

/**
 * Middleware to check if user has required role
 * @param {string} requiredRole - Role required to access the route
 * @returns {Function} Express middleware
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.role || req.role !== requiredRole) {
      return next(new ForbiddenError(`Accès refusé. Rôle ${requiredRole} requis.`));
    }
    next();
  };
};

module.exports = requireRole;
