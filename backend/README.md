# Backend G-House

## Pricing Réservation
Formule: `(loyerMensuel + depot) + commission`
- `baseRent` = loyer mensuel du logement au moment de la réservation
- `deposit` = champ `deposit` du logement (par défaut 0)
- `commissionRate` = variable d'environnement `RESERVATION_COMMISSION_RATE` (défaut 0.4)
- `commission` = `(baseRent + deposit) * commissionRate`
- `total` = `baseRent + deposit + commission`
Tous les champs sont stockés dans la collection `bookings` pour traçabilité.

## Évènements (Event Bus)
Chaque évènement est émis via `emit(eventName, payload, meta)` où `meta.traceId` transporte l'identifiant de corrélation.

Principaux évènements :
- booking.created | booking.statusUpdated | booking.confirmed
- marketplace.item.created | marketplace.item.reserved | marketplace.item.given | marketplace.item.cancelled
- insurance.policy.created | insurance.policy.canceled
- moving.request.created | moving.request.scheduled | moving.request.started | moving.request.completed | moving.request.canceled

## Correlation / Trace ID
Middleware génère ou relaye `x-request-id`.
- Entrée: si l'en-tête `x-request-id` est fourni il est réutilisé.
- Sinon un UUID est généré.
- Ajouté à la réponse: `x-request-id`.
- Exposé aux logs pino via propriété `traceId` et propagé dans `meta.traceId` des évènements.
Webhook Stripe génère un pseudo trace id `webhook-<bookingId>`.

## Métriques Prometheus (`/metrics`)
Préfixe automatique `ghouse_` pour les métriques par défaut de `prom-client`.

Custom:
- ghouse_http_requests_total{method,route,status}
- ghouse_http_request_duration_seconds_bucket/sum/count
- ghouse_booking_created_total
- ghouse_booking_confirmed_total
- ghouse_booking_mismatch_total
- ghouse_marketplace_items_created_total
- ghouse_insurance_policies_created_total
- ghouse_moving_requests_created_total
- ghouse_moving_requests_completed_total
- ghouse_concierge_requests_created_total
- ghouse_http_4xx_total
- ghouse_http_5xx_total
- ghouse_exceptions_total

## Erreurs & Exceptions
Les réponses 4xx/5xx sont comptabilisées (counters 4xx/5xx). Les exceptions non catchées et promesses rejetées incrémentent `ghouse_exceptions_total`.

## Tests
Jest + Supertest + mongodb-memory-server. Lancement: `npm test` à la racine ou dans `backend/`.

## Variables d'environnement / Validation
Validation forte via `zod` dans `config/env.js`. En production le processus stoppe si des variables obligatoires sont invalides.

Principales variables (voir `.env.example` assaini) :

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| MONGODB_URI | oui | Connexion MongoDB |
| JWT_SECRET | oui | Secret JWT (>=32 chars) |
| STRIPE_SECRET_KEY | oui | Clé Stripe pour API charges/webhooks |
| STRIPE_WEBHOOK_SECRET | oui | Validation signature webhook |
| CLOUDINARY_CLOUD_NAME | oui | Nom cloud Cloudinary |
| CLOUDINARY_API_KEY | oui | Clé publique Cloudinary |
| CLOUDINARY_API_SECRET | oui | Secret Cloudinary |
| VERCEL_FRONTEND_URL | non | URL frontend (défaut prod) |
| RESERVATION_COMMISSION_RATE | non | Commission (défaut 0.4) |
| LOG_LEVEL | non | Niveau logs (info, debug, warn) |
| ENABLE_REQUEST_TRACE | non | true/false pour traçage request-id |
| SENTRY_DSN | non | Activation Sentry (si défini) |
| SENTRY_TRACES_SAMPLE_RATE | non | Fraction de transactions (0.0-1.0) |
| SENTRY_PROFILES_SAMPLE_RATE | non | Fraction de profils de performance |

Conseils :
1. Créer `.env`, `.env.test`, `.env.production`.
2. Ne jamais committer de secrets réels : utiliser placeholders dans `.env.example`.
3. Rotation immédiate si fuite constatée.

## Endpoints principaux

### Auth
```
POST /api/auth/register
POST /api/auth/login
```

### Housing
```
GET /api/housing/:id
POST /api/housing
PATCH /api/housing/:id
GET /api/housing/search/radius?lat=..&lon=..&radiusKm=..&minPrice=&maxPrice=&type=
GET /api/housing/insights/stats   # stats de classification (popular, high_demand, rare)
```

Recherche géographique : requête 2dsphere sur `locationPoint` (GeoJSON { type: "Point", coordinates: [lon, lat] }). Index créé dans le modèle.

### Concierge (service d'assistance logement)
```
POST   /api/concierge            # Créer une requête concierge
GET    /api/concierge            # Lister mes requêtes
GET    /api/concierge/:id        # Détail
GET    /api/concierge/:id/suggestions   # Logements compatibles (zone + budget + type)
PATCH  /api/concierge/:id/status        # Mise à jour statut (in_progress|matched|closed)
```
Champs principaux d'une requête : budgetMonthly, depositBudget, desiredTypes[], zonePoint (GeoJSON), zoneRadiusKm, upfrontDeposit.

Statuts : `pending` (initial) -> `in_progress` -> `matched` -> `closed` (simplifié; transitions strictes à implémenter ultérieurement).

### Marketplace / Moving / Insurance
Endpoints existants (voir routes correspondantes) émettent leurs évènements métier et alimentent les métriques.

## Vérification utilisateur automatique
Upload / suppression de documents (`ProfileDoc`) déclenche un recalcul du statut `user.verification.status` (`unverified|pending|verified`). Hook post-save/remove sur le modèle de documents.

## Recherche géographique / Suggestions
Les suggestions concierge combinent :
- Rayon: requête $near sur zonePoint
- Budget: price <= budgetMonthly et deposit <= depositBudget (si fourni)
- Types: filtrage sur desiredTypes[] si non vide

## Sécurité & Secrets
Les secrets dans un historique Git public doivent être ROTATÉS. Voir la section Variables d'environnement.

## Sentry & APM
Sentry est intégré de façon conditionnelle : si `SENTRY_DSN` est présent, initialisation avec:
- Tracing HTTP & middleware Express (`requestHandler`, `tracingHandler`, `errorHandler`).
- Sampling configurable via `SENTRY_TRACES_SAMPLE_RATE` (ex: `0.1` = 10%).
- Profiling Node via `@sentry/profiling-node` (activer avec `SENTRY_PROFILES_SAMPLE_RATE`).

Recommandations prod :
1. Commencer avec `SENTRY_TRACES_SAMPLE_RATE=0.1` puis ajuster selon coût/volume.
2. `SENTRY_PROFILES_SAMPLE_RATE` faible (ex: 0.02) pour coûts CPU limités.
3. Ajouter un tag version (via variable `RELEASE` future) pour suivre les déploiements.
4. Filtrer PII (ne pas logger docs ou email en clair dans `breadcrumbs`).

Pour désactiver Sentry : ne pas définir `SENTRY_DSN`.

## Tests
Jest + Supertest + mongodb-memory-server. Lancement: `npm test`. Les nouveaux tests couvrent : création concierge, recherche radius, suggestions, update statut, auto vérification utilisateur.

## Roadmap succincte
- Tests webhook Stripe (mismatch)
- Idempotence booking
- File/queue (ex: BullMQ) pour traitements asynchrones
- Traces distribuées (OTel) si microservices
- Transitions stricte des statuts concierge + métrique status updates
- Pagination & limites sur suggestions concierge
- Métrique temps moyen de résolution concierge
- Export OpenAPI pour endpoints concierge & geo
