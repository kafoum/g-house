const { z } = require('zod');

const createPolicySchema = z.object({
  housing: z.string().min(1, 'housing requis'),
  provider: z.string().min(2),
  coverageType: z.enum(['basic','premium','complete']).default('basic'),
  startDate: z.string().refine(v => !isNaN(Date.parse(v)), 'Date invalide'),
  endDate: z.string().refine(v => !isNaN(Date.parse(v)), 'Date invalide'),
  priceMonthly: z.number().positive(),
  currency: z.string().optional().default('EUR')
}).refine(d => new Date(d.endDate) > new Date(d.startDate), {
  message: 'endDate doit être > startDate',
  path: ['endDate']
});

const listPoliciesQuery = z.object({
  status: z.enum(['active','pending','canceled','expired']).optional(),
  housing: z.string().optional()
});

module.exports = { createPolicySchema, listPoliciesQuery };
