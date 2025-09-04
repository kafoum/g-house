const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // 1. Récupérer le token de l'en-tête de la requête
  try {
    const token = req.headers.authorization.split(' ')[1]; // "Bearer TOKEN"

    // 2. Vérifier et décoder le token
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Ajouter les informations de l'utilisateur à l'objet de la requête
    req.userData = { userId: decodedToken.id, userRole: decodedToken.role };

    // 4. Continuer vers la prochaine fonction de la route
    next();
  } catch (error) {
    // En cas d'erreur (pas de token ou token invalide)
    return res.status(401).json({ message: 'Authentification échouée.' });
  }
};