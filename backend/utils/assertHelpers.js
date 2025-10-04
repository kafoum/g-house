const { ForbiddenError, NotFoundError } = require('../errors/AppError');

/**
 * Assert that a resource exists
 * @param {Object} resource - The resource to check
 * @param {string} message - Error message if resource doesn't exist
 * @throws {NotFoundError}
 */
function assertExists(resource, message = 'Ressource non trouvée.') {
  if (!resource) {
    throw new NotFoundError(message);
  }
}

/**
 * Assert that the user owns the resource
 * @param {Object} resource - The resource to check
 * @param {string} userId - Current user ID
 * @param {string} ownerField - Field name containing the owner ID (default: 'landlord')
 * @param {string} message - Error message if user doesn't own resource
 * @throws {ForbiddenError}
 */
function assertOwnership(resource, userId, ownerField = 'landlord', message = 'Accès refusé. Vous n\'êtes pas le propriétaire de cette ressource.') {
  const ownerId = typeof resource[ownerField] === 'object' && resource[ownerField]._id
    ? resource[ownerField]._id.toString()
    : resource[ownerField].toString();

  if (ownerId !== userId.toString()) {
    throw new ForbiddenError(message);
  }
}

/**
 * Assert that the user has the required role
 * @param {string} userRole - Current user role
 * @param {string} requiredRole - Required role
 * @param {string} message - Error message if user doesn't have role
 * @throws {ForbiddenError}
 */
function assertRole(userRole, requiredRole, message = 'Accès refusé. Rôle insuffisant.') {
  if (userRole !== requiredRole) {
    throw new ForbiddenError(message);
  }
}

module.exports = {
  assertExists,
  assertOwnership,
  assertRole,
};
