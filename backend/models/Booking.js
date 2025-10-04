const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    // Référence au locataire qui fait la demande de réservation
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Référence au logement concerné par la réservation
    housing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Housing',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    // Le statut de la réservation (en attente, confirmée, annulée, etc.)
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better query performance
bookingSchema.index({ tenant: 1 });
bookingSchema.index({ housing: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ startDate: 1, endDate: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;