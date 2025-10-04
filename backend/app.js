require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { errorHandler, NotFoundError } = require('./middleware/errorHandler');
const config = require('./config/env');
const pinoHttp = require('pino-http');
const pino = require('pino');

// Models side effects (indexes) ensured by requiring them somewhere if needed
require('./models/User');
require('./models/Housing');
require('./models/Booking');
require('./models/Conversation');
require('./models/Message');
require('./models/Notification');

const authRoutes = require('./routes/authRoutes');
const housingRoutes = require('./routes/housingRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const marketplaceRoutes = require('./modules/marketplace/routes');
const insuranceRoutes = require('./modules/insurance/routes');
const movingRoutes = require('./modules/moving/routes');
const conciergeRoutes = require('./modules/concierge/routes');
const { validate } = require('./validation/validate');
const { registerSchema, loginSchema, housingCreateSchema, housingUpdateSchema, housingListQuery } = require('./validation/schemas');
const { on } = require('./events/bus');
const { metricsMiddleware, register: metricsRegister, counters } = require('./metrics');
const { initSentry } = require('./monitoring/sentry');

const app = express();
// Init Sentry (si DSN présent)
const Sentry = initSentry(app);
const server = http.createServer(app);
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
// Correlation / trace id
const { randomUUID } = require('crypto');
app.use((req,res,next) => {
  const rid = req.headers['x-request-id'] || randomUUID();
  req.id = rid;
  res.setHeader('x-request-id', rid);
  next();
});
app.use(pinoHttp({ logger, customProps: (req) => ({ traceId: req.id }) }));
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}
// Sécurité & perf
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(metricsMiddleware);

// Instrumentation exceptions non catchées
process.on('uncaughtException', (err) => {
  counters.exceptionsTotal.inc();
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', (reason) => {
  counters.exceptionsTotal.inc();
  logger.error({ reason }, 'Unhandled rejection');
});

// Dev event logging
if (process.env.NODE_ENV === 'development') {
  const interesting = [
    'booking.created','booking.statusUpdated','booking.confirmed',
    'marketplace.item.created','marketplace.item.reserved','marketplace.item.given','marketplace.item.cancelled',
    'insurance.policy.created','insurance.policy.canceled',
    'moving.request.created','moving.request.scheduled','moving.request.started','moving.request.completed','moving.request.canceled',
     'concierge.request.created',
  ];
  interesting.forEach(evt => on(evt, ({ payload, meta }) => logger.debug({ evt, payload, meta }, 'event')));
  on('booking.created', () => counters.bookingCreated.inc());
  on('booking.confirmed', () => counters.bookingConfirmed.inc());
  on('marketplace.item.created', () => counters.marketplaceItemsCreated.inc());
  on('insurance.policy.created', () => counters.insurancePoliciesCreated.inc());
  on('moving.request.created', () => counters.movingRequestsCreated.inc());
  on('moving.request.completed', () => counters.movingRequestsCompleted.inc());
  on('concierge.request.created', () => counters.conciergeRequestsCreated.inc());
}

// DB connect (could be extracted)
mongoose.connect(config.mongoUri)
  .then(()=> logger.info('Mongo connecté'))
  .catch(err => logger.error({ err }, 'Erreur connexion Mongo'));

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret
});

app.use(cors({ origin: config.frontendUrl, methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', credentials: true }));

// Webhook Stripe (RAW body) avant express.json
const { stripeWebhook } = require('./controllers/webhookController');
app.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// JSON parser après le webhook
app.use(express.json());

// Routes
app.get('/', (req,res)=> res.send('Bienvenue sur l\'API de G-House !'));
app.get('/health', (req,res)=> {
  const dbState = mongoose.connection.readyState;
  const statuses = ['disconnected','connected','connecting','disconnecting'];
  res.json({ status: 'ok', db: statuses[dbState] || 'unknown', version: '1.0.0', uptime: process.uptime() });
});
app.get('/metrics', async (req,res) => {
  res.set('Content-Type', metricsRegister.contentType);
  res.end(await metricsRegister.metrics());
});

// Auth avec validation
app.use('/api', authRoutes);
// Housing (ajout validation via surcharges locales si besoin; laisser dans routes pour garder upload)
app.use('/api/housing', housingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/marketplace/items', marketplaceRoutes);
app.use('/api/insurance/policies', insuranceRoutes);
app.use('/api/moving/requests', movingRoutes);
app.use('/api/concierge/requests', conciergeRoutes);

app.use((req,res,next)=> next(new NotFoundError('Route non trouvée')));
if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}
app.use(errorHandler);

module.exports = { app, server, logger };
