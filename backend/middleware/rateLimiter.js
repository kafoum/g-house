const rateLimit = require('express-rate-limit');

/**
 * Rate limiter pour les routes d'authentification
 * Limite: 5 tentatives par fenêtre de 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requêtes maximum
  message: {
    message: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true, // Retourne les informations de rate limit dans les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
});

/**
 * Rate limiter pour le webhook Stripe
 * Limite: 100 requêtes par fenêtre de 15 minutes
 */
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes maximum
  message: {
    message: 'Trop de requêtes webhook. Veuillez réessayer plus tard.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter général pour l'API
 * Limite: 100 requêtes par fenêtre de 15 minutes
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes maximum par IP
  message: {
    message: 'Trop de requêtes. Veuillez réessayer dans 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => {
    // Ignorer le rate limiting pour certaines routes si nécessaire
    return false;
  }
});

module.exports = {
  authLimiter,
  webhookLimiter,
  apiLimiter
};
