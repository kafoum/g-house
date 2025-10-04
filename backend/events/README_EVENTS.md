# Event Bus (Interne)

Evénements émis actuellement :

## Réservations (booking)
- `booking.created` `{ id, tenant, housing, total }`
- `booking.statusUpdated` `{ id, status }`
- `booking.confirmed` `{ id, mismatch, expectedTotal, recorded }`

## Marketplace
- `marketplace.item.created` `{ id, owner, totalPrice }`
- `marketplace.item.reserved` `{ id, reservedBy }`
- `marketplace.item.given` `{ id }`
- `marketplace.item.cancelled` `{ id }`

## Assurance
- `insurance.policy.created` `{ id, housing, user, provider }`
- `insurance.policy.canceled` `{ id }`

## Utilisation
Importer `emit` ou `on` :
```js
const { emit, on } = require('../events/bus');
```
Ajouter un listener (ex: logging) :
```js
if (process.env.NODE_ENV === 'development') {
  const { on } = require('../events/bus');
  ['booking.created','marketplace.item.created'].forEach(evt=> on(evt, p=> console.log('[EVENT]', evt, p)));
}
```

## Roadmap
- Persistance / relecture (Kafka / Redis Streams).
- Retries & DLQ.
- Abstraction de versioning payload.
