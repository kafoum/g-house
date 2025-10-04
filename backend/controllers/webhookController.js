const stripe = require('stripe')(require('../config/env').stripe.secretKey || 'sk_test_dummy');
const Booking = require('../models/Booking');
const Housing = require('../models/Housing');
const { calculateReservationBreakdown } = require('../utils/priceCalculator');
const { emit } = require('../events/bus');
const config = require('../config/env');

async function stripeWebhook(req, res) {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = config.stripe.webhookSecret;
  if (!webhookSecret) return res.status(500).json({ message: 'Webhook secret manquant' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      try {
        const booking = await Booking.findById(bookingId);
        if (booking) {
          const housing = await Housing.findById(booking.housing);
          if (housing) {
            const commissionRate = Number(process.env.RESERVATION_COMMISSION_RATE || booking.commissionRate || 0.4);
            const breakdown = calculateReservationBreakdown({ monthlyRent: housing.price, deposit: housing.deposit || 0, commissionRate });
            const expectedTotal = breakdown.total;
            const recorded = booking.totalAmount;
            let mismatch = false;
            if (Math.abs(expectedTotal - recorded) > 0.01) mismatch = true;
            booking.status = 'confirmed';
            booking.mismatch = mismatch;
            await booking.save();
            emit('booking.confirmed', { id: booking._id.toString(), mismatch, expectedTotal, recorded }, { traceId: `webhook-${booking._id.toString()}` });
            if (mismatch) {
              const { counters } = require('../metrics');
              counters.bookingMismatch.inc();
            }
          }
        }
      } catch (e) { /* logging plus tard */ }
    }
  }
  res.json({ received: true });
}

module.exports = { stripeWebhook };
