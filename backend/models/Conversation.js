const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    // La liste des participants à la conversation
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    // Le logement associé à la conversation
    housing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Housing',
        required: true
    },
    // Le dernier message de la conversation
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    // La date de création de la conversation
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
