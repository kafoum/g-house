// Middleware générique de validation avec Zod
const { ZodError } = require('zod');
const { BadRequestError } = require('../middleware/errorHandler');

function validate({ body, query, params }) {
  return (req, res, next) => {
    try {
      if (body) req.body = body.parse(req.body);
      if (query) req.query = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
        return next(new BadRequestError('Validation échouée', 'VALIDATION_ERROR', { issues }));
      }
      next(err);
    }
  };
}

module.exports = { validate };
