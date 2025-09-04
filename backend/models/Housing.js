const mongoose = require('mongoose');

const housingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    location: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        zipCode: { type: String, required: true }
    },
    type: {
        type: String,
        enum: ['chambre', 'studio', 'T1', 'T2'],
        required: true
    },
    amenities: {
        type: [String], // Array de strings pour les équipements (ex: "Wi-Fi", "lave-linge")
        default: []
    },
    // Le lien vers le propriétaire de l'annonce
    landlord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Fait référence au modèle 'User'
        required: true
    },
    // Pour stocker les URLs des images
    images: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Housing = mongoose.model('Housing', housingSchema);
module.exports = Housing;