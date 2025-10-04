const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('../errors/AppError');

module.exports = (req, res, next) => {
  try {
    // 1. Récupérer le token de l'en-tête de la requête
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token manquant ou invalide.');
    }

    const token = authHeader.split(' ')[1];

    // 2. Vérifier et décoder le token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Ajouter les informations de l'utilisateur à l'objet de la requête
    req.userData = { userId: decodedToken.userId, userRole: decodedToken.role };
    req.userId = decodedToken.userId; // For backward compatibility
    req.role = decodedToken.role; // For backward compatibility

    // 4. Continuer vers la prochaine fonction de la route
    next();
  } catch (error) {
    // En cas d'erreur (pas de token ou token invalide)
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Token invalide.'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expiré.'));
    }
    return next(error);
  }
};
