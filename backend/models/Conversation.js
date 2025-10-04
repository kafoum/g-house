const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    // L'ID du logement concerné par cette discussion
    housing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Housing',
        required: true, // Doit être requis pour que la création de conversation fonctionne
    },
    
    // Les IDs des deux utilisateurs (landlord et tenant)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    
    // 🔑 CORRECTION CLÉ : Référence au dernier message envoyé (pour la liste)
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null, 
    },
    
}, {
    timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

conversationSchema.index({ housing: 1, updatedAt: -1 });
conversationSchema.index({ participants: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;