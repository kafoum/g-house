// Fichier : backend/index.js
// NOTE: Structure historique conservée temporairement. Une version refactorisée
// modulaire existe maintenant dans app.js avec routes & controllers séparés.
// Progressivement, migrer la logique restante vers les contrôleurs.

// =====================================================================\\
// 0. CONFIGURATION DES VARIABLES D'ENVIRONNEMENT
// =====================================================================\\
require('dotenv').config();
const { app: refactoredApp, server: refactoredServer, logger } = require('./app');
// On continue d'exposer le serveur existant pour compatibilité (WebSocket etc.)
const config = require('./config/env');

// 🔑 CLÉ : Définition des URL critiques (MONGODB_URI est pris de .env)
const PORT = config.port;
const FRONTEND_URL = config.frontendUrl;
const JWT_SECRET = config.jwtSecret;
// Assurez-vous que STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET sont bien dans votre fichier .env

// =====================================================================\\
// 1. IMPORTS DES MODULES ET INITIALISATION
// =====================================================================\\
// Anciennes dépendances conservées pour WebSocket & routes legacy encore dans ce fichier
const authMiddleware = require('./middleware/auth');
const { errorHandler, NotFoundError, BadRequestError } = require('./middleware/errorHandler');
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { calculatePrice } = require('./utils/priceCalculator');
const rateLimit = require('express-rate-limit');

// Modules WebSocket
const http = require('http');
const WebSocket = require('ws');

// INITIALISATION DE STRIPE
const stripe = require('stripe')(config.stripe.secretKey); 

// Configuration Cloudinary
cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret
});

// Configuration Multer pour la gestion des fichiers en mémoire (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importe les modèles Mongoose
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const ProfileDoc = require('./models/ProfileDoc'); 

// Initialisation d'Express
// Réutilise app et server refactorisés
const app = refactoredApp;
const server = refactoredServer;

// Logger déjà ajouté dans app.js


// =====================================================================\\
// 2. CONNEXION À LA BASE DE DONNÉES
// (Supprimée ici - centralisée désormais dans app.js pour éviter double connexion)


// =====================================================================\\
// 3. MIDDLEWARE GÉRAUX ET CORS
// =====================================================================\\

// 🔑 CLÉ : Configuration CORS avec l'URL Frontend
const corsOptions = {
    // 🔑 Utilisation de la variable FRONTEND_URL pour l'origine
    origin: FRONTEND_URL, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// ⚠️ ATTENTION : Express.json doit être APRÈS la définition du webhook Stripe si vous l'utilisez
app.use(express.json()); 

// =====================================================================\\
// 3.b RATE LIMITING (auth & paiement & register)
// =====================================================================\\
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requêtes
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Trop de tentatives. Réessayez plus tard.' }
});
const paymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
// Limiteur global IP
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

// Limiteur par utilisateur pour opérations d'écriture (utilise une map en mémoire)
const userWriteHits = new Map();
const USER_WRITE_WINDOW_MS = 60 * 1000;
const USER_WRITE_MAX = 60; // 60 écritures/minute
function userWriteLimiter(req, res, next) {
    const key = req.userId || req.ip;
    const now = Date.now();
    const entry = userWriteHits.get(key) || { count: 0, start: now };
    if (now - entry.start > USER_WRITE_WINDOW_MS) {
        entry.count = 0; entry.start = now;
    }
    entry.count += 1;
    userWriteHits.set(key, entry);
    if (entry.count > USER_WRITE_MAX) {
        return res.status(429).json({ message: 'Trop d\'opérations d\'écriture. Réduisez le rythme.' });
    }
    next();
}



// =====================================================================\\
// 5. ROUTES D'AUTHENTIFICATION ET UTILISATEUR (/api)
// =====================================================================\\

// 5.1 Inscription d'un nouvel utilisateur
app.post('/api/register', authLimiter, async (req, res, next) => {
    const { name, email, password, role } = req.body;
    try {
        if (!name || !email || !password) {
            throw new BadRequestError('Champs requis manquants');
        }
        const user = new User({ name, email, password, role });
        await user.save();
        res.status(201).json({ message: 'Utilisateur créé avec succès.', user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        if (error.code === 11000) {
            res.status(409).json({ message: 'Email déjà utilisé.' });
        } else {
            next(error);
        }
    }
});

// 6.1 Créer un logement (Propriétaire seulement)
app.post('/api/housing', authMiddleware, userWriteLimiter, upload.array('images', 5), async (req, res) => {
    if (req.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Propriétaire requis.' });
    }

    try {
        const { title, description, price, address, city, zipCode, type, amenities } = req.body;
        
        // Validation basique
        if (!title || !description || !price || !address || !city || !zipCode || !type) {
            return res.status(400).json({ message: 'Tous les champs requis ne sont pas remplis.' });
        }

        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            return res.status(400).json({ message: 'Prix invalide.' });
        }

        const amenityList = amenities ? amenities.split(',').map(a => a.trim()).filter(a => a.length > 0) : [];
        const imageUrls = [];

        // Upload des images vers Cloudinary
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: `g-house/housing_${req.userId}`,
                });
                imageUrls.push(result.secure_url);
            }
        }
        
        const newHousing = new Housing({
            title,
            description,
            price: priceNum,
            location: { address, city, zipCode },
            type,
            amenities: amenityList,
            landlord: req.userId,
            images: imageUrls,
        });

        await newHousing.save();
        res.status(201).json({ message: 'Logement créé avec succès.', housing: newHousing });

    } catch (error) {
        console.error('Erreur lors de la création du logement:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la création du logement.' });
    }
});

// 6.2 Modifier un logement (Propriétaire du logement seulement)
app.put('/api/housing/:id', authMiddleware, userWriteLimiter, upload.array('images', 5), async (req, res) => {
    if (req.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Propriétaire requis.' });
    }

    try {
        const housingId = req.params.id;
        const housing = await Housing.findById(housingId);

        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }

        // Vérification de la propriété
        if (housing.landlord.toString() !== req.userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        const { title, description, price, address, city, zipCode, type, amenities } = req.body;
        
        // Mise à jour des champs
        housing.title = title || housing.title;
        housing.description = description || housing.description;
        housing.price = price ? parseFloat(price) : housing.price;
        housing.location.address = address || housing.location.address;
        housing.location.city = city || housing.location.city;
        housing.location.zipCode = zipCode || housing.location.zipCode;
        housing.type = type || housing.type;
        housing.amenities = amenities ? amenities.split(',').map(a => a.trim()).filter(a => a.length > 0) : housing.amenities;


        // Gestion des images: Si de NOUVELLES images sont uploadées, on les ajoute/remplace
        if (req.files && req.files.length > 0) {
            const newImageUrls = [];
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: `g-house/housing_${req.userId}`,
                });
                newImageUrls.push(result.secure_url);
            }
            // ⚠️ ATTENTION : Cela écrase toutes les anciennes images. Ajustez la logique si vous voulez les fusionner.
            housing.images = newImageUrls; 
        }

        await housing.save();
        res.status(200).json({ message: 'Logement mis à jour avec succès.', housing });

    } catch (error) {
        console.error('Erreur lors de la modification du logement:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la modification.' });
    }
});

// 6.3 Supprimer un logement (Propriétaire du logement seulement)
app.delete('/api/housing/:id', authMiddleware, userWriteLimiter, async (req, res) => {
    if (req.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Propriétaire requis.' });
    }

    try {
        const housingId = req.params.id;
        const result = await Housing.findOneAndDelete({ _id: housingId, landlord: req.userId });

        if (!result) {
            return res.status(404).json({ message: 'Logement non trouvé ou vous n\'êtes pas le propriétaire.' });
        }
        // 🔔 Optionnel : Ajouter la suppression des images de Cloudinary
        await Booking.deleteMany({ housing: housingId }); // Supprimer les réservations liées
        await Conversation.deleteMany({ housing: housingId }); // Supprimer les conversations liées

        res.status(200).json({ message: 'Logement supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur lors de la suppression.' });
    }
});

// 6.4 Récupérer la liste de TOUS les logements (avec filtres, public)
app.get('/api/housing', async (req, res, next) => {
    try {
        const { city, price_min, price_max, type, page = 1, limit = 10 } = req.query;
        const filters = { status: 'active' };
        if (city) filters['location.city'] = { $regex: city, $options: 'i' };
        if (type) filters.type = type;
        if (price_min || price_max) {
            filters.price = {};
            if (price_min) filters.price.$gte = parseFloat(price_min);
            if (price_max) filters.price.$lte = parseFloat(price_max);
        }
        const pageNum = Math.max(parseInt(page, 10), 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 50);
        const skip = (pageNum - 1) * limitNum;
        const [items, total] = await Promise.all([
            Housing.find(filters)
                .populate('landlord', 'name')
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 }),
            Housing.countDocuments(filters)
        ]);
        const totalPages = Math.ceil(total / limitNum) || 1;
        res.status(200).json({
            data: items,
            meta: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1
            }
        });
    } catch (error) {
        next(error);
    }
});

// 6.5 Récupérer les détails d'un logement (public)
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id).populate('landlord', '_id name email role');
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des détails.' });
    }
});

// 6.6 Récupérer les logements de l'utilisateur connecté (Propriétaire seulement)
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    if (req.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Propriétaire requis.' });
    }
    try {
        const housing = await Housing.find({ landlord: req.userId });
        res.status(200).json({ housing });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// =====================================================================\\
// 7. ROUTES RÉSERVATIONS ET PAIEMENT (/api/bookings)
// =====================================================================\\

// 7.1 Créer une session de paiement Stripe
app.post('/api/bookings/create-checkout-session', paymentLimiter, authMiddleware, userWriteLimiter, async (req, res, next) => {
    if (req.role !== 'tenant') {
        return res.status(403).json({ message: 'Seul un locataire peut effectuer une réservation.' });
    }
    const { housingId, startDate, endDate } = req.body;
    
    try {
        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }

        // 1. Calcul du prix (à implémenter dans priceCalculator.js)
        const totalAmountCents = calculatePrice(housing.price, startDate, endDate); 
        const totalAmountEuros = totalAmountCents / 100;
        
        if (totalAmountCents <= 0) {
            return res.status(400).json({ message: 'Période de réservation invalide.' });
        }

        // 2. Créer la réservation initiale (statut 'pending')
        const newBooking = new Booking({
            tenant: req.userId,
            housing: housingId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: 'pending',
            // Optionnel : enregistrer le prix dans la réservation
            totalPrice: totalAmountEuros, 
        });
        await newBooking.save();

        // 3. Créer la session de paiement Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Réservation : ${housing.title}`,
                        },
                        unit_amount: totalAmountCents, // Stripe utilise des cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // Redirection en cas de succès et d'échec
            success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
            cancel_url: `${FRONTEND_URL}/housing/${housingId}`,
            
            // Métadonnées pour le webhook
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: req.userId,
            },
        });

        res.status(200).json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error('Erreur lors de la création de la session Stripe:', error);
        next(error);
    }
});

// 7.2 Récupérer les réservations d'un utilisateur (Locataire ou Propriétaire)
app.get('/api/user/bookings', authMiddleware, async (req, res) => {
    try {
        let bookings;
        if (req.role === 'tenant') {
            // Locataire : Récupérer les siennes
            bookings = await Booking.find({ tenant: req.userId })
                .populate('housing', 'title price location')
                .sort({ createdAt: -1 });
        } else if (req.role === 'landlord') {
            // Propriétaire : Récupérer celles liées à ses logements
            const userHousing = await Housing.find({ landlord: req.userId }).select('_id');
            const housingIds = userHousing.map(h => h._id);

            bookings = await Booking.find({ housing: { $in: housingIds } })
                .populate('tenant', 'name email') // Qui a réservé
                .populate('housing', 'title price location') // Quel logement
                .sort({ createdAt: -1 });
        } else {
            return res.status(403).json({ message: 'Rôle non supporté pour cette action.' });
        }

        res.status(200).json({ bookings });

    } catch (error) {
        console.error('Erreur lors de la récupération des réservations:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// 7.3 Mettre à jour le statut d'une réservation (Propriétaire seulement)
app.put('/api/user/bookings/:id/status', authMiddleware, async (req, res) => {
    if (req.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Propriétaire requis.' });
    }
    const { status } = req.body;
    const bookingId = req.params.id;

    if (!['confirmed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Statut de réservation invalide.' });
    }

    try {
        const booking = await Booking.findById(bookingId).populate('housing', 'landlord');

        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        // Vérification de la propriété du logement
        if (booking.housing.landlord.toString() !== req.userId) {
            return res.status(403).json({ message: 'Accès refusé. Ce logement ne vous appartient pas.' });
        }

        booking.status = status;
        await booking.save();

        // 🔔 Optionnel : Créer une notification pour le locataire

        res.status(200).json({ message: `Statut de la réservation mis à jour en ${status}.`, booking });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// =====================================================================\\
// 8. ROUTES MESSAGERIE (/api/conversations)
// =====================================================================\\

// 8.1 Démarrer ou obtenir une conversation existante (Protégée)
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    const { housingId, recipientId } = req.body; // recipientId est le propriétaire
    const tenantId = req.userId; // L'utilisateur connecté est le locataire

    if (tenantId === recipientId) {
        return res.status(400).json({ message: 'Vous ne pouvez pas démarrer une conversation avec vous-même.' });
    }
    
    try {
        // 1. Rechercher une conversation existante pour ce logement et ces deux participants
        let conversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [tenantId, recipientId] }
        });

        if (!conversation) {
            // 2. Si non trouvée, créer une nouvelle conversation
            conversation = new Conversation({
                housing: housingId,
                participants: [tenantId, recipientId],
            });
            await conversation.save();
        }

        // On renvoie la conversation (nouvelle ou existante)
        res.status(200).json({ conversation });
        
    } catch (error) {
        console.error('Erreur lors du démarrage de la conversation:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'accès à la conversation.' });
    }
});

// 8.2 Obtenir la liste des conversations de l'utilisateur (Protégée)
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.userId })
            .populate('participants', 'name') // Récupère les noms des participants
            .populate('housing', 'title') // Récupère le titre du logement
            .populate('lastMessage') // Récupère le contenu du dernier message (optionnel)
            .sort({ updatedAt: -1 }); // Trie par la plus récente

        res.status(200).json({ conversations });

    } catch (error) {
        console.error('Erreur lors de la récupération des conversations:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// 8.3 Obtenir les messages d'une conversation spécifique (Protégée)
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    const conversationId = req.params.id;
    try {
        // 1. Vérifier si l'utilisateur est participant à la conversation
        const conversation = await Conversation.findOne({ 
            _id: conversationId, 
            participants: req.userId 
        });

        if (!conversation) {
            return res.status(403).json({ message: 'Accès refusé à cette conversation.' });
        }

        // 2. Récupérer les messages
        const messages = await Message.find({ conversation: conversationId })
            .populate('sender', 'name')
            .sort({ createdAt: 1 });

        res.status(200).json({ messages });
        
    } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// 8.4 Obtenir les détails d'une conversation (pour le front)
app.get('/api/conversations/:id', authMiddleware, async (req, res) => {
    const conversationId = req.params.id;
    try {
        const conversation = await Conversation.findOne({ 
            _id: conversationId, 
            participants: req.userId 
        })
        .populate('participants', '_id name role') 
        .populate('housing', 'title'); 

        if (!conversation) {
            return res.status(403).json({ message: 'Conversation non trouvée ou accès refusé.' });
        }
        res.status(200).json({ conversation });
        
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// =====================================================================\\
// 9. INITIALISATION DU WEBSOCKET (MESSAGERIE)
// =====================================================================\\

const wss = new WebSocket.Server({ 
    server,
    // 🔑 CLÉ : Permet uniquement les connexions depuis l'URL du frontend
    verifyClient: (info, done) => {
        const origin = info.origin;
        if (origin === FRONTEND_URL) {
            done(true); // Autorise la connexion
        } else {
            console.log(`Tentative de connexion WebSocket refusée depuis l'origine: ${origin}`);
            done(false); // Refuse la connexion
        }
    }
}); 

// Map pour associer un ID utilisateur à sa connexion WebSocket active
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null;
    
    // 1. Authentification de la connexion WebSocket via le token JWT
    try {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const token = urlParams.get('token');

        if (!token) {
            ws.close(1008, 'Token JWT manquant');
            return;
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId; 

        if (userId) {
            userWsMap.set(userId, ws);
            console.log(`WebSocket connecté pour l'utilisateur: ${userId}`);
        } else {
            ws.close(1008, 'ID utilisateur non valide');
        }
        
    } catch (error) {
        console.error('Erreur d\'authentification WebSocket:', error);
        ws.close(1008, 'Authentification échouée');
        return;
    }

    // 2. Gestion des messages entrants (type: 'NEW_MESSAGE')
    ws.on('message', async (message) => {
        if (!userId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Non authentifié.' }));
            return;
        }
        
        try {
            const data = JSON.parse(message.toString());

            if (data.type === 'NEW_MESSAGE' && data.content && data.conversationId && data.recipientId) {
                const { content, conversationId, recipientId } = data;

                // 3. Sauvegarder le message dans la base de données
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId,
                    content: content,
                });
                await newMessage.save();

                // 4. Mettre à jour la conversation avec le dernier message
                const conversation = await Conversation.findByIdAndUpdate(conversationId, 
                    { lastMessage: newMessage._id, updatedAt: Date.now() }, 
                    { new: true }
                );
                
                // Préparer l'objet message à envoyer aux clients
                const messageToSend = {
                    type: 'MESSAGE_RECEIVED',
                    payload: {
                        _id: newMessage._id, 
                        content: newMessage.content, 
                        sender: { _id: userId }, 
                        createdAt: newMessage.createdAt, 
                        conversation: conversationId,
                    }
                };
                
                // 5. Envoyer au destinataire
                const recipientWs = userWsMap.get(recipientId.toString());
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messageToSend));
                }

                // 6. Envoyer à l'expéditeur (pour l'afficher immédiatement)
                ws.send(JSON.stringify(messageToSend)); 
            }
        } catch (error) {
            console.error('Erreur de traitement de message WebSocket:', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur.' }));
        }
    });

    // --- Gestion de la déconnexion ---
    ws.on('close', () => {
        if (userId) {
            userWsMap.delete(userId); 
            console.log(`WebSocket déconnecté pour l'utilisateur: ${userId}`);
        }
    });
});


// =====================================================================\\
// 10. ROUTES DIVERSES ET DÉMARRAGE DU SERVEUR
// =====================================================================\\

// Documentation API (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House !');
});

app.get('/health', async (req, res) => {
    const dbState = mongoose.connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
    const dbStatuses = ['disconnected','connected','connecting','disconnecting'];
    res.json({
        status: 'ok',
        version: '1.0.0',
        uptime: process.uptime(),
        db: dbStatuses[dbState] || 'unknown',
        timestamp: new Date().toISOString()
    });
});

// Démarrage du serveur HTTP (qui écoute aussi le WebSocket)
// Démarrage serveur (si pas déjà lancé ailleurs)
server.listen(PORT, () => {
    logger.info({ port: PORT }, 'Serveur G-House démarré (index legacy)');
});