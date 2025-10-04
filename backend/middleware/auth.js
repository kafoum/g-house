const jwt = require('jsonwebtoken');

/**
 * Middleware d'authentification JWT.
 * Normalise l'ajout des infos utilisateur sur l'objet req pour correspondre
 * aux usages du code existant (req.userId, req.role) tout en conservant
 * req.userData pour compatibilité.
 */
module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant.' });
    }
    const token = authHeader.split(' ')[1];
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // Champs normalisés utilisés partout ailleurs dans le code
    req.userId = decodedToken.userId;
    req.role = decodedToken.role;
    // Compatibilité avec ancien code éventuel
    req.userData = { userId: decodedToken.userId, userRole: decodedToken.role };

    return next();
  } catch {
    return res.status(401).json({ message: 'Authentification échouée.', error: 'INVALID_TOKEN' });
  }
};
