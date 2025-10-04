const client = require('prom-client');

// Registry
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'ghouse_' });

// HTTP metrics
const httpRequestsTotal = new client.Counter({
  name: 'ghouse_http_requests_total',
  help: 'Total des requêtes HTTP',
  labelNames: ['method','route','status']
});

const httpRequestDuration = new client.Histogram({
  name: 'ghouse_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP (s)',
  buckets: [0.01,0.05,0.1,0.3,0.5,1,2,5],
  labelNames: ['method','route','status']
});

// Domain metrics
const bookingCreated = new client.Counter({ name: 'ghouse_booking_created_total', help: 'Bookings créées' });
const bookingConfirmed = new client.Counter({ name: 'ghouse_booking_confirmed_total', help: 'Bookings confirmées' });
const marketplaceItemsCreated = new client.Counter({ name: 'ghouse_marketplace_items_created_total', help: 'Items marketplace créés' });
const insurancePoliciesCreated = new client.Counter({ name: 'ghouse_insurance_policies_created_total', help: 'Policies assurance créées' });
const bookingMismatch = new client.Counter({ name: 'ghouse_booking_mismatch_total', help: 'Bookings avec mismatch montant vs recalcul' });
const movingRequestsCreated = new client.Counter({ name: 'ghouse_moving_requests_created_total', help: 'Demandes de déménagement créées' });
const movingRequestsCompleted = new client.Counter({ name: 'ghouse_moving_requests_completed_total', help: 'Demandes de déménagement complétées' });
const conciergeRequestsCreated = new client.Counter({ name: 'ghouse_concierge_requests_created_total', help: 'Demandes concierge créées' });

// Error metrics
const http4xx = new client.Counter({ name: 'ghouse_http_4xx_total', help: 'Total des réponses HTTP 4xx' });
const http5xx = new client.Counter({ name: 'ghouse_http_5xx_total', help: 'Total des réponses HTTP 5xx' });
const exceptionsTotal = new client.Counter({ name: 'ghouse_exceptions_total', help: 'Exceptions non catchées et promesses rejetées' });

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDuration);
register.registerMetric(bookingCreated);
register.registerMetric(bookingConfirmed);
register.registerMetric(marketplaceItemsCreated);
register.registerMetric(insurancePoliciesCreated);
register.registerMetric(bookingMismatch);
register.registerMetric(movingRequestsCreated);
register.registerMetric(movingRequestsCompleted);
register.registerMetric(conciergeRequestsCreated);
register.registerMetric(http4xx);
register.registerMetric(http5xx);
register.registerMetric(exceptionsTotal);

function metricsMiddleware(req,res,next){
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route && req.route.path ? req.route.path : req.path;
    const status = res.statusCode;
    httpRequestsTotal.inc({ method: req.method, route, status });
    const diffNs = Number(process.hrtime.bigint() - start);
    const diffSec = diffNs / 1e9;
    httpRequestDuration.observe({ method: req.method, route, status }, diffSec);
    if (status >= 400 && status < 500) http4xx.inc();
    else if (status >= 500) http5xx.inc();
  });
  next();
}

module.exports = {
  register,
  metricsMiddleware,
  counters: { bookingCreated, bookingConfirmed, marketplaceItemsCreated, insurancePoliciesCreated, bookingMismatch, movingRequestsCreated, movingRequestsCompleted, conciergeRequestsCreated, http4xx, http5xx, exceptionsTotal }
};
