# G-House Backend

## Setup

### Prerequisites
- Node.js (v18 or higher)
- MongoDB
- Cloudinary account
- Stripe account

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - Set your MongoDB connection string
   - Generate a strong JWT secret (at least 32 characters)
   - Configure Cloudinary credentials
   - Configure Stripe API keys

### Development

Start the development server with hot reload:
```bash
npm run dev
```

### Production

Start the production server:
```bash
npm start
```

## Code Quality

### Linting

Check for code issues:
```bash
npm run lint
```

Fix auto-fixable issues:
```bash
npm run lint:fix
```

### Formatting

Format all code:
```bash
npm run format
```

## API Documentation

API documentation is available via Swagger at:
```
http://localhost:5000/api-docs
```

## Features

### Security
- ✅ Rate limiting on authentication and webhook endpoints
- ✅ Input validation using Zod schemas
- ✅ JWT token authentication with proper error handling
- ✅ Environment variable validation on startup
- ✅ Global error handling middleware

### Performance
- ✅ Database indexes on frequently queried fields
- ✅ Pagination on list endpoints (housing)
- ✅ Efficient query patterns with MongoDB

### Code Quality
- ✅ ESLint configuration for consistent code style
- ✅ Prettier for automatic code formatting
- ✅ Custom error classes for better error handling
- ✅ Validation middleware for all input data

## Project Structure

```
backend/
├── config/          # Configuration files (env validation)
├── errors/          # Custom error classes
├── middleware/      # Express middleware (auth, validation, error handling, rate limiting)
├── models/          # Mongoose models with indexes
├── validators/      # Zod validation schemas
├── utils/           # Utility functions
├── index.js         # Main application file
└── swagger.js       # Swagger configuration
```

## Environment Variables

See `.env.example` for required environment variables.

### Critical Variables
- `JWT_SECRET`: Must be at least 32 characters for security
- `MONGODB_URI`: MongoDB connection string
- `STRIPE_SECRET_KEY`: Stripe API secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

## API Rate Limits

- Authentication endpoints: 5 requests per 15 minutes per IP
- Webhook endpoint: 50 requests per 15 minutes per IP
- General API: 100 requests per 15 minutes per IP

## Validation

All user inputs are validated using Zod schemas:
- Authentication: Email format, password length
- Housing creation: All required fields, price validation, postal code format
- Housing updates: Optional fields with proper validation

## Database Indexes

The following indexes are configured for optimal performance:
- User: email (unique)
- Housing: landlord, status, location.city, type, price
- Booking: tenant, housing, status, startDate/endDate

## WebSocket

Real-time messaging is supported via WebSocket on the same port as the HTTP server.
Connection is authenticated using JWT token.
