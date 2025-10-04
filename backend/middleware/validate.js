const { ValidationError } = require('../errors/AppError');

/**
 * Validation middleware factory
 * @param {Object} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Replace request data with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      if (error.errors) {
        // Zod validation error
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return next(new ValidationError(
          errorMessages[0]?.message || 'Erreur de validation.',
          'VALIDATION_ERROR'
        ));
      }
      next(error);
    }
  };
};

module.exports = validate;
