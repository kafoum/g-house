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
    // Point GeoJSON pour recherche par rayon (longitude, latitude)
    locationPoint: {
        type: {
            type: String,
            enum: ['Point']
        },
        coordinates: {
            type: [Number], // [lon, lat]
            validate: {
                validator: function(v){ return !v || (Array.isArray(v) && v.length === 2); }
            }
        }
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
    deposit: { // caution optionnelle
        type: Number,
        default: 0,
        min: 0
    },
    aplEligible: { // logement éligible à l'APL
        type: Boolean,
        default: false
    },
    furnished: { // logement meublé ou non
        type: Boolean,
        default: true
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
    },
    views: { type: Number, default: 0, min: 0 }
});

housingSchema.index({ landlord: 1, createdAt: -1 });
housingSchema.index({ 'location.city': 1, price: 1 });
housingSchema.index({ status: 1 });
housingSchema.index({ locationPoint: '2dsphere' });

const Housing = mongoose.model('Housing', housingSchema);
module.exports = Housing;