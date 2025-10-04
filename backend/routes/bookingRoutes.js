const express = require('express');
const auth = require('../middleware/auth');
const { createCheckoutSession, listUserBookings, updateBookingStatus } = require('../controllers/bookingController');
const { validate } = require('../validation/validate');
const { bookingCreateSchema, bookingStatusSchema } = require('../validation/schemas');

const router = express.Router();

router.post('/create-checkout-session', auth, validate({ body: bookingCreateSchema }), createCheckoutSession);
router.get('/user', auth, listUserBookings);
router.put('/user/:id/status', auth, validate({ body: bookingStatusSchema }), updateBookingStatus);

module.exports = router;
