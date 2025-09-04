const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // L'utilisateur qui reçoit la notification
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Le message à afficher
    message: {
        type: String,
        required: true
    },
    // Le type de notification (par exemple, 'new_booking', 'booking_confirmed', etc.)
    type: {
        type: String,
        required: true,
        enum: ['new_booking', 'booking_confirmed', 'booking_cancelled', 'new_message']
    },
    // Le statut de lecture
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;