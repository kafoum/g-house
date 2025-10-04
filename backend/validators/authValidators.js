const { z } = require('zod');

/**
 * User Registration Schema
 */
const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.').max(100),
    email: z.string().email('Email invalide.'),
    password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.'),
    role: z.enum(['tenant', 'landlord']).optional().default('tenant')
  })
});

/**
 * User Login Schema
 */
const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalide.'),
    password: z.string().min(1, 'Le mot de passe est requis.')
  })
});

module.exports = {
  registerSchema,
  loginSchema
};
