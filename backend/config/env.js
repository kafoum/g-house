const { z } = require('zod');

/**
 * Environment variables validation schema
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  
  // Database
  MONGODB_URI: z.string().url('MONGODB_URI must be a valid URL'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  
  // Frontend
  VERCEL_FRONTEND_URL: z.string().url().optional(),
  
  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
  CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
  CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
  
  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
});

/**
 * Validate and parse environment variables
 * @throws {Error} If environment variables are invalid
 */
function validateEnv() {
  try {
    const validated = envSchema.parse(process.env);
    console.log('✓ Environment variables validated successfully');
    return validated;
  } catch (error) {
    console.error('❌ Invalid environment variables:');
    if (error.errors) {
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    }
    console.error('\nPlease check your .env file against .env.example');
    process.exit(1);
  }
}

module.exports = { validateEnv };
