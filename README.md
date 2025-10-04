# G-House 🏠

Plateforme de location de logements étudiants

## 📖 Description

G-House est une application web complète permettant la gestion de locations de logements étudiants. Elle connecte les propriétaires avec les locataires potentiels et facilite le processus de réservation et de paiement.

## 🏗️ Structure du Projet

Le projet est divisé en deux parties principales :

- **Backend** (`/backend`) - API REST Node.js/Express avec MongoDB
- **Frontend** (`/mon-app-g-house`) - Application React avec Vite

## 🚀 Démarrage Rapide

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configurer les variables d'environnement dans .env
npm run dev
```

Le serveur démarre sur `http://localhost:5000`

### Frontend

```bash
cd mon-app-g-house
npm install
npm run dev
```

L'application démarre sur `http://localhost:5173`

## ✨ Fonctionnalités Principales

### Pour les Locataires
- Recherche de logements avec filtres (ville, prix, type)
- Consultation des détails des logements
- Réservation en ligne avec paiement sécurisé (Stripe)
- Messagerie avec les propriétaires
- Gestion du profil et des documents

### Pour les Propriétaires
- Création et gestion d'annonces de logements
- Upload de photos via Cloudinary
- Tableau de bord des réservations
- Messagerie avec les locataires
- Gestion des documents des locataires

### Sécurité et Performance
- ✅ Authentification JWT sécurisée
- ✅ Validation des entrées avec Zod
- ✅ Rate limiting sur les routes critiques
- ✅ Gestion centralisée des erreurs
- ✅ Pagination des listes
- ✅ Index de base de données optimisés
- ✅ WebSocket pour la messagerie temps réel

## 📚 Documentation

- [Améliorations Backend](./backend/IMPROVEMENTS.md) - Documentation détaillée des améliorations récentes
- [Configuration](./backend/.env.example) - Variables d'environnement requises

## 🛠️ Technologies Utilisées

### Backend
- Node.js & Express 5
- MongoDB & Mongoose
- JWT pour l'authentification
- Stripe pour les paiements
- Cloudinary pour les images
- WebSocket (ws) pour le chat en temps réel
- Zod pour la validation
- ESLint & Prettier

### Frontend
- React 18
- Vite
- React Router
- Axios
- TailwindCSS
- WebSocket client

## 🔧 Scripts Disponibles

### Backend
```bash
npm start       # Production
npm run dev     # Développement avec nodemon
npm run lint    # Vérifier le code
npm run lint:fix # Corriger automatiquement
npm run format  # Formater avec Prettier
```

### Frontend
```bash
npm run dev     # Développement
npm run build   # Build de production
npm run preview # Prévisualiser le build
npm run lint    # Vérifier le code
```

## 🌍 Déploiement

- **Backend**: Déployé sur Render
- **Frontend**: Déployé sur Vercel

## 📝 Variables d'Environnement

### Backend
Voir le fichier `.env.example` dans `/backend` pour la liste complète.

Principales variables :
- `MONGODB_URI` - URI de connexion MongoDB
- `JWT_SECRET` - Secret pour les tokens JWT
- `STRIPE_SECRET_KEY` - Clé Stripe
- `CLOUDINARY_*` - Credentials Cloudinary

### Frontend
- `VITE_API_URL` - URL de l'API backend

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📄 Licence

ISC

## 👥 Auteurs

Projet développé dans le cadre d'une plateforme de location étudiante.

