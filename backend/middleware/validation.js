const { z } = require('zod');

/**
 * Middleware de validation des entrées utilisant Zod
 * @param {z.ZodSchema} schema - Le schéma Zod à valider
 * @param {string} source - Source des données ('body', 'query', 'params')
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      // Valider les données selon la source
      const data = req[source];
      const validated = schema.parse(data);
      
      // Remplacer les données par les données validées
      req[source] = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Formater les erreurs de validation Zod
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        return res.status(400).json({
          message: 'Erreur de validation des données.',
          code: 'VALIDATION_ERROR',
          errors: formattedErrors
        });
      }
      
      next(error);
    }
  };
};

module.exports = { validate };
