const mongoose = require('mongoose');

const profileDocSchema = new mongoose.Schema({
    // Référence à l'utilisateur qui a téléchargé le document
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Type de document (ex: "identity_card", "visale_guarantee")
    docType: {
        type: String,
        required: true,
        enum: ['identity_card', 'proof_of_address', 'visale_guarantee', 'proof_of_income']
    },
    // URL du document stocké
    docUrl: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const ProfileDoc = mongoose.model('ProfileDoc', profileDocSchema);
module.exports = ProfileDoc;