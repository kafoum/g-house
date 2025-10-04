const { z } = require('zod');

const createItemSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.enum(['meuble','electromenager','divers']),
  condition: z.enum(['new','good','used']).optional(),
  priceUser: z.coerce.number().positive().max(10),
  images: z.array(z.string().url()).max(5).optional()
});

const listQuerySchema = z.object({
  category: z.enum(['meuble','electromenager','divers']).optional(),
  status: z.enum(['active','reserved','given','cancelled','archived']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

module.exports = { createItemSchema, listQuerySchema };
