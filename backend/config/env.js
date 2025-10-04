// Validation forte des variables d'environnement avec Zod
const { z } = require('zod');

// Schéma des variables attendues
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(v => parseInt(v, 10)).default('5000'),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères'),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
  VERCEL_FRONTEND_URL: z.string().url().optional(),
  RESERVATION_COMMISSION_RATE: z.string().optional(),
  LOG_LEVEL: z.string().optional(),
  ENABLE_REQUEST_TRACE: z.string().optional()
  ,SENTRY_DSN: z.string().url().optional()
  ,SENTRY_TRACES_SAMPLE_RATE: z.string().optional()
  ,SENTRY_PROFILES_SAMPLE_RATE: z.string().optional()
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  if (process.env.NODE_ENV !== 'test') {
    console.error('[ENV ERROR] Variables invalides:', parsed.error.flatten().fieldErrors);
  }
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const data = parsed.success ? parsed.data : process.env;

// Normalisation / mapping utilisé ailleurs dans l'app
const config = {
  env: data.NODE_ENV || 'development',
  port: data.PORT || 5000,
  mongoUri: data.MONGODB_URI,
  jwtSecret: data.JWT_SECRET,
  stripe: {
    secretKey: data.STRIPE_SECRET_KEY,
    webhookSecret: data.STRIPE_WEBHOOK_SECRET
  },
  cloudinary: {
    cloudName: data.CLOUDINARY_CLOUD_NAME,
    apiKey: data.CLOUDINARY_API_KEY,
    apiSecret: data.CLOUDINARY_API_SECRET
  },
  frontendUrl: data.VERCEL_FRONTEND_URL || 'https://g-house.vercel.app',
  reservation: {
    commissionRate: data.RESERVATION_COMMISSION_RATE ? parseFloat(data.RESERVATION_COMMISSION_RATE) : 0.4
  },
  log: {
    level: data.LOG_LEVEL || 'info'
  },
  trace: {
    enabled: data.ENABLE_REQUEST_TRACE === 'true' || data.ENABLE_REQUEST_TRACE === '1'
  },
  sentry: {
    dsn: data.SENTRY_DSN,
    tracesSampleRate: data.SENTRY_TRACES_SAMPLE_RATE ? parseFloat(data.SENTRY_TRACES_SAMPLE_RATE) : 0.0,
    profilesSampleRate: data.SENTRY_PROFILES_SAMPLE_RATE ? parseFloat(data.SENTRY_PROFILES_SAMPLE_RATE) : 0.0
  }
};

module.exports = config;
