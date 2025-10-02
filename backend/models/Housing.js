// Fichier : models/Housing.js

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
        type: [String], 
        default: []
    },
    landlord: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // 🔑 CORRECTION CLÉ : Ajout du champ status
    status: {
        type: String,
        enum: ['active', 'inactive', 'archived'], // Options possibles pour le statut
        default: 'active' // L'annonce est active par défaut
    },
    // Fin de la CORRECTION CLÉ
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