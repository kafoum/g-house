const { z } = require('zod');

// Auth
const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(['tenant','landlord']).optional()
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

// Housing
const housingCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  price: z.coerce.number().positive(),
  address: z.string().min(3),
  city: z.string().min(2),
  zipCode: z.string().min(3),
  type: z.enum(['chambre','studio','T1','T2']),
  amenities: z.string().optional(),
  deposit: z.coerce.number().nonnegative().default(0).optional(),
  aplEligible: z.coerce.boolean().optional(),
  furnished: z.coerce.boolean().optional()
});

const housingUpdateSchema = housingCreateSchema.partial();

const housingListQuery = z.object({
  city: z.string().optional(),
  price_min: z.coerce.number().nonnegative().optional(),
  price_max: z.coerce.number().nonnegative().optional(),
  type: z.enum(['chambre','studio','T1','T2']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  aplEligible: z.coerce.boolean().optional(),
  furnished: z.coerce.boolean().optional()
});

// Booking
const bookingCreateSchema = z.object({
  housingId: z.string().length(24, 'housingId invalide'),
  startDate: z.string().datetime().or(z.string()),
  endDate: z.string().datetime().or(z.string())
});

const bookingStatusSchema = z.object({
  status: z.enum(['confirmed','cancelled'])
});

// Conversation
const conversationStartSchema = z.object({
  housingId: z.string().length(24),
  recipientId: z.string().length(24)
});

const messageSendSchema = z.object({
  type: z.literal('NEW_MESSAGE'),
  content: z.string().min(1),
  conversationId: z.string().length(24),
  recipientId: z.string().length(24)
});

module.exports = {
  registerSchema,
  loginSchema,
  housingCreateSchema,
  housingUpdateSchema,
  housingListQuery,
  bookingCreateSchema,
  bookingStatusSchema,
  conversationStartSchema,
  messageSendSchema
};
