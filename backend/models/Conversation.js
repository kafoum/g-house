const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    // L'ID du logement concerné par cette discussion (requis pour les conversations initiales)
    housing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Housing',
        required: true,
    },
    
    // Les IDs des deux utilisateurs (landlord et tenant)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    
    // 🔑 CORRECTION CLÉ : Référence au dernier message envoyé 
    // Mongoose a besoin de ce champ pour effectuer le .populate('lastMessage') dans index.js
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null, // Commence sans message
    },
    
}, {
    timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;