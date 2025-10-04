# Guide Déploiement sur Render

## 1. Préparation du dépôt
- Vérifier absence de secrets réels dans `.env.example` (OK).
- Branch principale propre / tests verts.
- Ajouter tag ou commit message clair (ex: `deploy: backend v1`).

## 2. Création du Service Render
1. Nouveau service -> Web Service.
2. Source: GitHub (sélectionner le repo).
3. Root directory: `backend` (important pour éviter d'installer le monorepo complet si inutile).
4. Runtime: Node.
5. Build Command: `npm install` (ou vide car Render détecte). Si monorepo: `npm install --prefix backend`.
6. Start Command: `npm start`.
7. Instance type: Starter (adapter selon charge prévue).

## 3. Variables d'environnement à définir
| Nom | Description |
|-----|-------------|
| PORT | (Render set automatiquement) |
| MONGODB_URI | URI Mongo Atlas |
| JWT_SECRET | Secret JWT robuste (>=48 chars) |
| STRIPE_SECRET_KEY | Clé secrète Stripe |
| STRIPE_WEBHOOK_SECRET | Secret signature webhook Stripe |
| CLOUDINARY_CLOUD_NAME | Cloudinary cloud |
| CLOUDINARY_API_KEY | Cloudinary key |
| CLOUDINARY_API_SECRET | Cloudinary secret |
| VERCEL_FRONTEND_URL | URL frontend prod |
| RESERVATION_COMMISSION_RATE | (ex: 0.4) |
| LOG_LEVEL | info |
| ENABLE_REQUEST_TRACE | true |
| SENTRY_DSN | (optionnel) |
| SENTRY_TRACES_SAMPLE_RATE | 0.1 (optionnel) |
| SENTRY_PROFILES_SAMPLE_RATE | 0.02 (optionnel) |

(Stripe: mettre à jour l'endpoint webhook vers `https://<service>.onrender.com/webhook`)

## 4. Webhook Stripe
- Dans Dashboard Stripe > Developers > Webhooks > Add endpoint.
- URL: `https://<service>.onrender.com/webhook`.
- Évènements nécessaires (ajuster selon logique): `checkout.session.completed`, `payment_intent.succeeded`, etc.
- Mettre à jour `STRIPE_WEBHOOK_SECRET` dans Render.

## 5. Santé & Monitoring
- Health check URL: `/health` (retour JSON `{ status: 'ok' }`).
- Metrics: `/metrics` (Prometheus); exposer via un dashboard externe si souhaité.
- Sentry: vérifier réception première transaction & erreur volontaire.

## 6. Sécurité
- CORS: déjà restreint à `VERCEL_FRONTEND_URL`.
- Headers sécurisés via `helmet`.
- JWT secret non committé.
- Rate limiting actif (global + auth + paiement).

## 7. Tests Post-Déploiement (checklist)
| Test | Méthode |
|------|---------|
| Health | GET /health -> 200 |
| Auth Register/Login | /api/auth/register + /api/auth/login |
| Housing create (landlord) | POST /api/housing (token landlord) |
| Radius search | GET /api/housing/search/radius |
| Concierge create | POST /api/concierge/requests |
| Metrics | GET /metrics (format texte) |
| Webhook Stripe | Envoyer event test depuis Dashboard |
| Sentry error | Provoquer erreur (ex: requête route inexistante + throw) |

## 8. Logs & Scaling
- Logs Render: vérifier absence de stack trace répétitive.
- Scaling horizontal: ajouter variable pour sticky sessions si WebSocket plus tard.
- TTL connexions Mongo: par défaut géré côté driver, rien à faire.

## 9. Mises à jour futures recommandées
- Séparer worker async (emails, matching concierge) si charge augmente.
- Ajouter cache (Redis) pour suggestions répétées.
- Ajouter index combiné `{ aplEligible:1, furnished:1, price:1 }` si volume > 50k docs.
- Export OpenAPI/Swagger pour documentation unifiée.

## 10. Rollback
- Conserver dernier tag stable (ex: `v1.0.0`).
- En cas d'incident, redeployer commit taggé précédent sur Render (Rollback bouton).

## 11. Dépannage rapide
| Symptom | Cause probable | Action |
|---------|----------------|--------|
| 500 au démarrage | Variable manquante | Vérifier logs + env Render |
| 401 partout | JWT_SECRET changé sans regenerer tokens | Forcer re-login clients |
| Webhook Stripe 400 | Mauvaise signature | Recréer `STRIPE_WEBHOOK_SECRET` |
| Latence élevée | Instance sous-dimensionnée | Upgrade plan | 
| Pas d'évènements Sentry | DSN absent / sampleRate=0 | Ajuster env |

---
Fin du guide.
