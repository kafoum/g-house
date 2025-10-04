const Booking = require('../models/Booking');
const Housing = require('../models/Housing');
const { calculatePrice, calculateReservationBreakdown } = require('../utils/priceCalculator');
const { ForbiddenError, NotFoundError, BadRequestError } = require('../middleware/errorHandler');
const config = require('../config/env');
const { emit } = require('../events/bus');
// Stripe stub en test si clé absente
let stripe;
if (config.stripe.secretKey) {
  stripe = require('stripe')(config.stripe.secretKey);
} else {
  stripe = { checkout: { sessions: { create: async ({ line_items, metadata, success_url }) => ({ id: 'test_session', url: success_url.replace('{CHECKOUT_SESSION_ID}', 'test_session') }) } } };
}

async function createCheckoutSession(req, res, next) {
  if (req.role !== 'tenant') return next(new ForbiddenError('Seul un locataire peut réserver.'));
  try {
    const { housingId, startDate, endDate } = req.body;
    const housing = await Housing.findById(housingId);
    if (!housing) throw new NotFoundError('Logement non trouvé.');
    const totalAmountCents = calculatePrice(housing.price, startDate, endDate);
    if (totalAmountCents <= 0) throw new BadRequestError('Période de réservation invalide.');
    // On prend le loyer mensuel comme base pour la caution & commission.
    const commissionRate = Number(process.env.RESERVATION_COMMISSION_RATE || 0.4);
    const breakdown = calculateReservationBreakdown({ monthlyRent: housing.price, deposit: housing.deposit || 0, commissionRate });
    const newBooking = await Booking.create({
      tenant: req.userId,
      housing: housingId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: 'pending',
      baseRent: breakdown.baseRent,
      deposit: breakdown.deposit,
      commission: breakdown.commission,
      commissionRate: breakdown.commissionRate,
      totalAmount: breakdown.total
    });
  emit('booking.created', { id: newBooking._id.toString(), tenant: req.userId, housing: housingId, total: breakdown.total }, { traceId: req.id });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
  price_data: { currency: 'eur', product_data: { name: `Réservation : ${housing.title}` }, unit_amount: Math.round(breakdown.total * 100) },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${config.frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
      cancel_url: `${config.frontendUrl}/housing/${housingId}`,
      metadata: { bookingId: newBooking._id.toString(), tenantId: req.userId }
    });
    res.json({ sessionId: session.id, url: session.url });
  } catch (e) { next(e); }
}

async function listUserBookings(req, res, next) {
  try {
    let bookings;
    if (req.role === 'tenant') {
      bookings = await Booking.find({ tenant: req.userId }).populate('housing', 'title price location').sort({ createdAt: -1 });
    } else if (req.role === 'landlord') {
      const userHousing = await Housing.find({ landlord: req.userId }).select('_id');
      const housingIds = userHousing.map(h => h._id);
      bookings = await Booking.find({ housing: { $in: housingIds } })
        .populate('tenant', 'name email')
        .populate('housing', 'title price location')
        .sort({ createdAt: -1 });
    } else return next(new ForbiddenError('Rôle non supporté.'));
    res.json({ bookings });
  } catch (e) { next(e); }
}

async function updateBookingStatus(req, res, next) {
  if (req.role !== 'landlord') return next(new ForbiddenError('Accès refusé. Propriétaire requis.'));
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate('housing', 'landlord');
    if (!booking) throw new NotFoundError('Réservation non trouvée.');
    if (booking.housing.landlord.toString() !== req.userId) return next(new ForbiddenError('Ce logement ne vous appartient pas.'));
  booking.status = status;
  await booking.save();
  emit('booking.statusUpdated', { id: booking._id.toString(), status }, { traceId: req.id });
  res.json({ message: `Statut mis à jour en ${status}.`, booking });
  } catch (e) { next(e); }
}

module.exports = { createCheckoutSession, listUserBookings, updateBookingStatus };
