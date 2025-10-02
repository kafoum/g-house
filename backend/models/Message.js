const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // La conversation à laquelle le message appartient
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    // L'expéditeur du message
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Le contenu du message
    content: {
        type: String,
        required: true,
        trim: true,
    },
    // Optionnel: peut être utilisé pour marquer comme lu/non lu
    isRead: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true // Ajoute createdAt (date d'envoi) et updatedAt
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;