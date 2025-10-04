const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Importation de bcryptjs

// On définit le schéma de l'utilisateur
const userSchema = new mongoose.Schema({
    // Le nom de l'utilisateur, requis
    name: {
        type: String,
        required: true,
        trim: true
    },
    // L'adresse email, requise et unique
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    // Le mot de passe de l'utilisateur, requis
    password: {
        type: String,
        required: true
    },
    // Le rôle de l'utilisateur : 'tenant' (locataire) ou 'landlord' (propriétaire)
    role: {
        type: String,
        enum: ['tenant', 'landlord'],
        default: 'tenant'
    },
    verification: {
        status: { type: String, enum: ['unverified','pending','verified'], default: 'unverified' },
        updatedAt: { type: Date }
    },
    // Une date de création
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware Mongoose pour hacher le mot de passe avant de sauvegarder
// Le mot-clé `function` est nécessaire pour que `this` référence le document Mongoose
userSchema.pre('save', async function(next) {
    // Ne rien faire si le mot de passe n'a pas été modifié
    if (!this.isModified('password')) {
        return next();
    }
    
    try {
        // Hacher le mot de passe avec un "salt" de 10
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        // En cas d'erreur, passe l'erreur au middleware suivant
        return next(error);
    }
});

// On crée et exporte le modèle basé sur le schéma
const User = mongoose.model('User', userSchema);
module.exports = User;