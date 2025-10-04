/**
 * Middleware global de gestion des erreurs
 * Centralise la gestion des erreurs pour des réponses cohérentes
 */
module.exports = (err, req, res, next) => {
  // Log l'erreur pour le débogage
  console.error('[ERROR]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    path: req.path,
    method: req.method
  });

  // Déterminer le code de statut
  const statusCode = err.statusCode || err.status || 500;
  
  // Déterminer le code d'erreur
  const errorCode = err.code || 'INTERNAL_ERROR';
  
  // Construire la réponse d'erreur
  const errorResponse = {
    message: err.message || 'Une erreur interne est survenue.',
    code: errorCode
  };

  // En développement, inclure la stack trace
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};
