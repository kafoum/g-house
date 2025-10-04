const Sentry = require('@sentry/node');
const ProfilingIntegration = require('@sentry/profiling-node').ProfilingIntegration;
const config = require('../config/env');

function initSentry(app){
  if (!config.sentry.dsn) return; // Sentry désactivé si DSN absent
  Sentry.init({
    dsn: config.sentry.dsn,
    integrations: [
      // Capture requêtes Express
      Sentry.integrations.http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new ProfilingIntegration()
    ],
    tracesSampleRate: config.sentry.tracesSampleRate || 0.1,
    profilesSampleRate: config.sentry.profilesSampleRate || 0.0,
    environment: config.env
  });
  return Sentry;
}

module.exports = { initSentry };
