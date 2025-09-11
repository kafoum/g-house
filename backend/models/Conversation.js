const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    // Les participants à la conversation, référence au modèle User
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    // Le logement associé à la conversation. Le champ est désormais optionnel.
    housing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Housing',
        required: false
    },
    // Ajout d'un champ sujet pour identifier facilement la conversation
    subject: {
        type: String,
        required: false
    },
    // Date de création de la conversation
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
