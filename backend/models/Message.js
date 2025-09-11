const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    // La conversation à laquelle le message appartient
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    // L'expéditeur du message
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Le contenu du message
    content: {
        type: String,
        required: true
    },
    // Indique si le message a été lu
    isRead: {
        type: Boolean,
        default: false
    },
    // La date d'envoi du message
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
