// Fichier : backend/index.js (Version corrigée)

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================
// 1. IMPORTS DES MODULES ET INITIALISATION
// ====================================================================
const authMiddleware = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const nodemailer = require('nodemailer'); 
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); 
const cors = require('cors'); 

// Modules WebSocket
const http = require('http');
const WebSocket = require('ws');

// INITIALISATION DE STRIPE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration Multer pour la gestion des fichiers en mémoire (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importe les modèles Mongoose
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');


// Initialisation de l'application Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Définition du port
const PORT = process.env.PORT || 10000;


// ====================================================================
// 2. MIDDLEWARE GÉNÉRAUX
// ====================================================================

// Connexion à la base de données MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB établie avec succès'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Middleware CORS pour autoriser les requêtes depuis votre frontend (Vercel)
const allowedOrigins = [
    'https://g-house.vercel.app', 
    'http://localhost:5173', // Pour le développement local
    // Ajoutez d'autres domaines si nécessaire
];

app.use(cors({
    origin: function (origin, callback) {
        // Permettre les requêtes sans 'origin' (comme les applications mobiles ou curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
}));

// Middleware pour parser les corps de requêtes JSON (utilisé pour toutes les routes SAUF celles utilisant Multer)
app.use(express.json());


// ====================================================================
// 3. ROUTES D'AUTHENTIFICATION (Exemple non inclus ici mais nécessaire dans votre projet)
// ====================================================================

// Route d'inscription
// app.post('/api/register', ...); 

// Route de connexion
// app.post('/api/login', ...); 

// ... (Autres routes d'authentification)


// ====================================================================
// 4. ROUTES LOGEMENTS (HOUSING)
// ====================================================================

// GET /api/housing : Récupérer toutes les annonces publiques
app.get('/api/housing', async (req, res) => {
    try {
        const housingList = await Housing.find()
            .populate('landlord', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ housing: housingList });
    } catch (error) {
        console.error("Erreur sur GET /api/housing:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des annonces.' });
    }
});

// GET /api/housing/:id : Récupérer les détails d'une annonce
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id)
            .populate('landlord', 'name email');

        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/housing/:id:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'annonce.' });
    }
});


// GET /api/user/housing : Récupérer les annonces du propriétaire connecté
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent voir leurs annonces.' });
        }
        
        const userHousing = await Housing.find({ landlord: req.userData.userId }).sort({ createdAt: -1 });
        res.status(200).json({ housing: userHousing });
    } catch (error) {
        console.error("Erreur sur GET /api/user/housing:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des annonces du propriétaire.' });
    }
});


// POST /api/user/housing : Créer une nouvelle annonce (Propriétaire uniquement)
app.post('/api/user/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent créer des annonces.' });
        }

        // 🔑 NOUVEAU: Extraction et conversion des données de req.body (Multipart)
        const { title, description, price, type, amenities, address, city, zipCode } = req.body;
        
        // Reconstruction de l'objet location
        const location = {
            address: address, 
            city: city, 
            zipCode: zipCode 
        };
        
        // Conversion du prix en nombre. Si c'est vide ou non valide, Mongoose lèvera une erreur 
        // ou ça deviendra NaN, ce qui sera géré par l'erreur de validation (correct)
        const parsedPrice = parseFloat(price); 
        
        // Traitement des équipements (amenities). Les transformer en tableau de chaînes.
        const parsedAmenities = amenities ? amenities.split(',').map(item => item.trim()).filter(item => item.length > 0) : [];
        
        // Traitement des images
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => {
                return cloudinary.uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
                    folder: "g-house-housing"
                });
            });

            const uploadResults = await Promise.all(uploadPromises);
            imageUrls = uploadResults.map(result => result.secure_url);
        }

        // Création du nouvel objet Housing
        const newHousing = new Housing({
            title,
            description,
            price: parsedPrice, // Utilise le prix PARSÉ
            location, // Utilise l'objet location reconstitué
            type,
            amenities: parsedAmenities,
            landlord: req.userData.userId,
            images: imageUrls,
        });

        await newHousing.save();

        res.status(201).json({ message: 'Annonce créée avec succès', housing: newHousing });

    } catch (error) {
        console.error("Erreur lors de la création de l'annonce:", error); 
        if (error.name === 'ValidationError') {
            // Renvoie une erreur 400 pour les problèmes de validation côté Mongoose
            return res.status(400).json({ 
                message: "Erreur de validation des données.", 
                errors: error.errors 
            });
        }
        res.status(500).json({ message: 'Erreur serveur interne lors de la création de l\'annonce.' });
    }
});


// ... (PUT /api/user/housing/:id et DELETE /api/user/housing/:id) ...


// ====================================================================
// 5. ROUTES RÉSERVATIONS (BOOKING)
// ====================================================================

// 🔑 ROUTE CORRIGÉE : GET /api/user/bookings : Récupérer les réservations
app.get('/api/user/bookings', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const userRole = req.userData.userRole;

        let bookings;

        if (userRole === 'tenant') {
            // Locataire: ses réservations
            bookings = await Booking.find({ tenant: userId })
                .populate('housing', 'title images') 
                .sort({ createdAt: -1 });
        } 
        else if (userRole === 'landlord') {
            // Propriétaire: réservations pour ses logements
            const housingOwned = await Housing.find({ landlord: userId }).select('_id');
            const housingIds = housingOwned.map(h => h._id);

            bookings = await Booking.find({ housing: { $in: housingIds } })
                .populate('tenant', 'name email') 
                .populate('housing', 'title images') 
                .sort({ createdAt: -1 });
        } else {
            return res.status(403).json({ message: 'Rôle non reconnu.' });
        }

        res.status(200).json({ bookings });
    } catch (error) {
        console.error("Erreur sur GET /api/user/bookings :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des réservations.' });
    }
});

// ... (Autres routes de booking) ...


// ====================================================================
// 6. ROUTES MESSAGERIE (CONVERSATIONS)
// ====================================================================

// GET /api/conversations : Récupérer la liste des conversations (inchangé)
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.userData.userId })
            .populate('housing', 'title images') // Détails de l'annonce
            .populate('participants', 'name email') // Détails des participants
            .populate({
                path: 'lastMessage',
                select: 'content sender createdAt'
            })
            .sort({ updatedAt: -1 });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des conversations.' });
    }
});

// ... (Autres routes de messagerie) ...


// ====================================================================
// 7. GESTION DES WEBSOCKETS
// ====================================================================

// Map pour associer userId et l'instance WebSocket (inchangé)
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    // ... (Logique WebSocket complète, y compris l'authentification et la gestion des messages)
});


// ====================================================================
// ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});