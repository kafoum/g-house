const { z } = require('zod');

/**
 * Schémas de validation pour les différentes routes de l'API
 */

// Schéma pour l'inscription
const registerSchema = z.object({
  name: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim(),
  email: z.string()
    .email('Format d\'email invalide')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères')
    .max(100, 'Le mot de passe ne peut pas dépasser 100 caractères'),
  role: z.enum(['tenant', 'landlord'])
    .optional()
    .default('tenant')
});

// Schéma pour la connexion
const loginSchema = z.object({
  email: z.string()
    .email('Format d\'email invalide')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(1, 'Le mot de passe est requis')
});

// Schéma pour la création de logement
const createHousingSchema = z.object({
  title: z.string()
    .min(5, 'Le titre doit contenir au moins 5 caractères')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères')
    .trim(),
  description: z.string()
    .min(20, 'La description doit contenir au moins 20 caractères')
    .max(2000, 'La description ne peut pas dépasser 2000 caractères')
    .trim(),
  price: z.string()
    .or(z.number())
    .transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num <= 0) {
        throw new Error('Prix invalide');
      }
      return num;
    }),
  address: z.string()
    .min(5, 'L\'adresse doit contenir au moins 5 caractères')
    .max(200, 'L\'adresse ne peut pas dépasser 200 caractères')
    .trim(),
  city: z.string()
    .min(2, 'La ville doit contenir au moins 2 caractères')
    .max(100, 'La ville ne peut pas dépasser 100 caractères')
    .trim(),
  zipCode: z.string()
    .min(2, 'Le code postal doit contenir au moins 2 caractères')
    .max(20, 'Le code postal ne peut pas dépasser 20 caractères')
    .trim(),
  type: z.enum(['apartment', 'house', 'studio', 'room'], {
    errorMap: () => ({ message: 'Type de logement invalide' })
  }),
  amenities: z.string().optional()
});

// Schéma pour la requête de liste de logements (query params)
const housingListQuerySchema = z.object({
  page: z.string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1)
    .refine((val) => val > 0, 'La page doit être supérieure à 0'),
  limit: z.string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 10)
    .refine((val) => val > 0 && val <= 100, 'La limite doit être entre 1 et 100'),
  city: z.string().optional(),
  type: z.string().optional(),
  minPrice: z.string()
    .optional()
    .transform((val) => val ? parseFloat(val) : undefined),
  maxPrice: z.string()
    .optional()
    .transform((val) => val ? parseFloat(val) : undefined)
});

// Schéma pour la création de réservation
const createBookingSchema = z.object({
  housingId: z.string()
    .min(1, 'ID du logement requis'),
  startDate: z.string()
    .refine((val) => !isNaN(Date.parse(val)), 'Format de date invalide pour la date de début'),
  endDate: z.string()
    .refine((val) => !isNaN(Date.parse(val)), 'Format de date invalide pour la date de fin')
}).refine((data) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: 'La date de fin doit être après la date de début',
  path: ['endDate']
});

module.exports = {
  registerSchema,
  loginSchema,
  createHousingSchema,
  housingListQuerySchema,
  createBookingSchema
};
