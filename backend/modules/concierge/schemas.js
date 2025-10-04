const { z } = require('zod');

const createConciergeSchema = z.object({
  budgetMonthly: z.number().positive(),
  depositBudget: z.number().min(0),
  desiredTypes: z.array(z.string()).optional().default([]),
  zone: z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    radiusKm: z.number().positive().max(50).default(3)
  }),
});

module.exports = { createConciergeSchema };
