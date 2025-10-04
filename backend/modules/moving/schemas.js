const { z } = require('zod');

const createMoveSchema = z.object({
  fromAddress: z.string().min(5).optional(),
  toAddress: z.string().min(5).optional(),
  housingFrom: z.string().optional(),
  housingTo: z.string().optional(),
  volumeM3: z.number().positive().optional(),
  desiredDate: z.string().refine(v => !isNaN(Date.parse(v)), 'Date invalide'),
  notes: z.string().max(500).optional()
});

const listMovesQuery = z.object({
  status: z.enum(['requested','scheduled','in_progress','completed','canceled']).optional()
});

const scheduleMoveSchema = z.object({
  scheduledDate: z.string().refine(v => !isNaN(Date.parse(v)), 'Date invalide')
});

module.exports = { createMoveSchema, listMovesQuery, scheduleMoveSchema };
