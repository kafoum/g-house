# G-House Backend - Améliorations de l'API

Ce document décrit les améliorations récentes apportées au backend de l'application G-House.

## 📋 Table des matières

- [Nouvelles fonctionnalités](#nouvelles-fonctionnalités)
- [Structure du projet](#structure-du-projet)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [API Routes](#api-routes)
- [Sécurité](#sécurité)

## 🎯 Nouvelles fonctionnalités

### 1. Gestion Centralisée des Erreurs

Un middleware global de gestion des erreurs a été ajouté pour fournir des réponses cohérentes en cas d'erreur.

**Fichier**: `middleware/errorHandler.js`

**Utilisation dans les routes**:
```javascript
app.get('/api/example', async (req, res, next) => {
  try {
    // Votre logique
  } catch (error) {
    next(error); // Passe l'erreur au gestionnaire global
  }
});
```

**Format de réponse d'erreur**:
```json
{
  "message": "Message d'erreur descriptif",
  "code": "ERROR_CODE"
}
```

### 2. Validation des Entrées avec Zod

Tous les endpoints critiques valident maintenant les données d'entrée avec Zod.

**Fichiers**: 
- `middleware/validation.js` - Middleware de validation
- `validation/schemas.js` - Schémas de validation

**Routes validées**:
- `/api/register` - Inscription utilisateur
- `/api/login` - Connexion utilisateur
- `/api/housing` (POST) - Création de logement
- `/api/housing` (GET) - Liste des logements (query params)
- `/api/bookings/create-checkout-session` - Création de réservation

**Exemple de réponse d'erreur de validation**:
```json
{
  "message": "Erreur de validation des données.",
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Format d'email invalide"
    }
  ]
}
```

### 3. Rate Limiting (Limitation de Débit)

Protection contre les abus et attaques par force brute.

**Fichier**: `middleware/rateLimiter.js`

**Limiteurs configurés**:

| Route | Limite | Fenêtre | Description |
|-------|--------|---------|-------------|
| `/api/register`, `/api/login` | 5 requêtes | 15 minutes | Protection anti-brute force |
| `/webhook` | 100 requêtes | 15 minutes | Protection webhook Stripe |
| API générale | 100 requêtes | 15 minutes | Limite générale (si activé) |

**Réponse en cas de dépassement**:
```json
{
  "message": "Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

### 4. Pagination sur la Liste des Logements

La route `/api/housing` supporte maintenant la pagination.

**Paramètres de requête**:
- `page` (défaut: 1) - Numéro de page
- `limit` (défaut: 10, max: 100) - Nombre de résultats par page
- `city` - Filtrer par ville
- `type` - Filtrer par type de logement
- `price_min` - Prix minimum
- `price_max` - Prix maximum

**Exemple de requête**:
```
GET /api/housing?page=2&limit=20&city=Paris&type=apartment
```

**Réponse**:
```json
{
  "housing": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 5. Index de Base de Données

Des index ont été ajoutés aux modèles pour améliorer les performances des requêtes.

**Housing (Logements)**:
- `landlord` - Recherche par propriétaire
- `location.city` - Recherche par ville
- `status` - Filtrage par statut
- `type` - Filtrage par type
- `price` - Tri/filtrage par prix
- `createdAt` - Tri par date de création

**Booking (Réservations)**:
- `tenant` - Recherche par locataire
- `housing` - Recherche par logement
- `status` - Filtrage par statut
- `startDate, endDate` - Recherche par dates

### 6. ESLint et Prettier

Configuration ajoutée pour maintenir un code propre et cohérent.

**Scripts disponibles**:
```bash
npm run lint          # Vérifier le code
npm run lint:fix      # Corriger automatiquement
npm run format        # Formater avec Prettier
```

## 📁 Structure du projet

```
backend/
├── middleware/
│   ├── auth.js              # Authentification JWT
│   ├── errorHandler.js      # Gestionnaire d'erreurs global
│   ├── rateLimiter.js       # Limiteurs de débit
│   └── validation.js        # Middleware de validation
├── models/
│   ├── Booking.js           # Modèle Réservation (avec index)
│   ├── Conversation.js      # Modèle Conversation
│   ├── Housing.js           # Modèle Logement (avec index)
│   ├── Message.js           # Modèle Message
│   ├── Notification.js      # Modèle Notification
│   ├── ProfileDoc.js        # Modèle Document Profil
│   └── User.js              # Modèle Utilisateur
├── validation/
│   └── schemas.js           # Schémas de validation Zod
├── utils/
│   └── priceCalculator.js   # Utilitaires de calcul de prix
├── .eslintrc.js             # Configuration ESLint
├── .prettierrc.json         # Configuration Prettier
├── .env.example             # Exemple de variables d'environnement
├── index.js                 # Point d'entrée principal
└── package.json             # Dépendances et scripts
```

## 🚀 Installation

```bash
cd backend
npm install
```

## ⚙️ Configuration

1. Copier le fichier `.env.example` vers `.env`:
```bash
cp .env.example .env
```

2. Remplir les variables d'environnement:
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster-url/dbname
JWT_SECRET=votre_secret_jwt_tres_long_et_securise

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend
VERCEL_FRONTEND_URL=https://g-house.vercel.app

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxxxxxxxxxxxxx
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

**Important**: Le `JWT_SECRET` doit être une chaîne aléatoire longue (minimum 32 caractères).

## 🏃 Utilisation

### Développement
```bash
npm run dev
```

### Production
```bash
npm start
```

### Linting et Formatage
```bash
# Vérifier le code
npm run lint

# Corriger automatiquement
npm run lint:fix

# Formater le code
npm run format
```

## 🔌 API Routes

### Authentification

#### POST `/api/register`
Inscription d'un nouvel utilisateur.

**Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "motdepasse123",
  "role": "tenant" // ou "landlord"
}
```

#### POST `/api/login`
Connexion utilisateur.

**Body**:
```json
{
  "email": "john@example.com",
  "password": "motdepasse123"
}
```

**Réponse**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "userId": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "tenant"
  }
}
```

### Logements

#### GET `/api/housing`
Liste des logements avec pagination et filtres.

**Query params**:
- `page` (optionnel)
- `limit` (optionnel)
- `city` (optionnel)
- `type` (optionnel)
- `price_min` (optionnel)
- `price_max` (optionnel)

#### POST `/api/housing`
Créer un logement (propriétaire uniquement).

**Headers**: `Authorization: Bearer <token>`

**Body** (multipart/form-data):
```
title: "Appartement T2"
description: "Bel appartement au centre ville..."
price: 800
address: "123 Rue Exemple"
city: "Paris"
zipCode: "75001"
type: "apartment"
amenities: "wifi,parking,balcon" (optionnel)
images: [fichiers] (max 5)
```

#### GET `/api/housing/:id`
Détails d'un logement.

#### PUT `/api/housing/:id`
Modifier un logement (propriétaire uniquement).

#### DELETE `/api/housing/:id`
Supprimer un logement (propriétaire uniquement).

### Réservations

#### POST `/api/bookings/create-checkout-session`
Créer une session de paiement Stripe.

**Headers**: `Authorization: Bearer <token>`

**Body**:
```json
{
  "housingId": "65f1234567890abcdef12345",
  "startDate": "2024-01-15",
  "endDate": "2024-02-15"
}
```

## 🔒 Sécurité

### Mesures de sécurité implémentées:

1. **Rate Limiting**: Protection contre les abus et attaques par force brute
2. **Validation des entrées**: Prévention des injections et données malveillantes
3. **Authentification JWT**: Tokens sécurisés avec expiration (7 jours)
4. **Hachage des mots de passe**: bcrypt avec salt de 10
5. **CORS configuré**: Limité au frontend autorisé
6. **Gestion d'erreurs**: Pas de divulgation d'informations sensibles en production
7. **Webhook sécurisé**: Vérification de signature Stripe

### Bonnes pratiques:

- Ne jamais commiter le fichier `.env`
- Utiliser des secrets forts et longs
- Changer régulièrement les secrets en production
- Monitorer les logs pour détecter les activités suspectes
- Limiter les permissions des utilisateurs MongoDB

## 📝 Notes de développement

### Ajout d'une nouvelle route avec validation

1. Créer le schéma de validation dans `validation/schemas.js`:
```javascript
const mySchema = z.object({
  field: z.string().min(1)
});
```

2. Utiliser dans la route:
```javascript
app.post('/api/myroute', 
  authMiddleware, 
  validate(mySchema), 
  async (req, res, next) => {
    try {
      // Logique
    } catch (error) {
      next(error);
    }
  }
);
```

### Propagation des erreurs

Toujours utiliser `next(error)` au lieu de `res.status(500).json(...)` pour les erreurs inattendues. Le middleware d'erreur s'en chargera.

## 🐛 Débogage

Pour activer les logs détaillés en développement, assurez-vous que `NODE_ENV` n'est pas défini sur `production`.

Les erreurs en développement incluent la stack trace complète.

## 📚 Dépendances principales

- **express** (^5.1.0) - Framework web
- **mongoose** (^8.18.0) - ODM MongoDB
- **zod** (^3.x) - Validation de schémas
- **express-rate-limit** (^7.x) - Rate limiting
- **jsonwebtoken** (^9.0.2) - JWT
- **bcryptjs** (^3.0.2) - Hachage de mots de passe
- **stripe** (^18.5.0) - Paiements
- **cloudinary** (^2.7.0) - Gestion d'images

## 🔄 Prochaines améliorations suggérées

- [ ] Tests unitaires et d'intégration
- [ ] Logs structurés (winston/pino)
- [ ] Heartbeat WebSocket
- [ ] Cache Redis pour les listes populaires
- [ ] Job cron pour nettoyer les réservations expirées
- [ ] Métriques Prometheus
- [ ] Documentation Swagger améliorée

## 📞 Support

Pour toute question ou problème, veuillez créer une issue sur le dépôt GitHub.
