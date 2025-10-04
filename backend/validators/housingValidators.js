const { z } = require('zod');

/**
 * Create Housing Schema
 */
const createHousingSchema = z.object({
  body: z.object({
    title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères.').max(200),
    description: z.string().min(10, 'La description doit contenir au moins 10 caractères.'),
    price: z.string().or(z.number()).transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num <= 0) {
        throw new Error('Prix invalide.');
      }
      return num;
    }),
    address: z.string().min(5, 'L\'adresse doit contenir au moins 5 caractères.'),
    city: z.string().min(2, 'La ville doit contenir au moins 2 caractères.'),
    zipCode: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres.'),
    type: z.enum(['chambre', 'studio', 'T1', 'T2'], {
      errorMap: () => ({ message: 'Type de logement invalide.' })
    }),
    amenities: z.string().optional()
  })
});

/**
 * Update Housing Schema (all fields optional)
 */
const updateHousingSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).optional(),
    price: z.string().or(z.number()).transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(num) || num <= 0) {
        throw new Error('Prix invalide.');
      }
      return num;
    }).optional(),
    address: z.string().min(5).optional(),
    city: z.string().min(2).optional(),
    zipCode: z.string().regex(/^\d{5}$/).optional(),
    type: z.enum(['chambre', 'studio', 'T1', 'T2']).optional(),
    amenities: z.string().optional(),
    status: z.enum(['active', 'inactive', 'archived']).optional()
  })
});

module.exports = {
  createHousingSchema,
  updateHousingSchema
};
