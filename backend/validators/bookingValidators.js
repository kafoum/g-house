const { z } = require('zod');

/**
 * Create Booking Schema
 */
const createBookingSchema = z.object({
  body: z.object({
    housingId: z.string().min(1, 'ID du logement requis.'),
    startDate: z.string().refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime()) && parsedDate > new Date();
    }, 'La date de début doit être une date valide dans le futur.'),
    endDate: z.string().refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, 'La date de fin doit être une date valide.')
  }).refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end > start;
  }, {
    message: 'La date de fin doit être après la date de début.',
    path: ['endDate']
  })
});

/**
 * Update Booking Status Schema
 */
const updateBookingStatusSchema = z.object({
  body: z.object({
    status: z.enum(['pending', 'confirmed', 'cancelled'], {
      errorMap: () => ({ message: 'Statut invalide.' })
    })
  })
});

module.exports = {
  createBookingSchema,
  updateBookingStatusSchema
};
