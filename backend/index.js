// Fichier : backend/index.js

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// Importe les modules nécessaires
const authMiddleware = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Utilisé pour hacher et comparer les mots de passe
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const path = require('path');
const cors = require('cors'); 

// Importe les modules WebSocket
const http = require('http');
const WebSocket = require('ws');

// INITIALISATION DE STRIPE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

// Configurez Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurez Multer pour la gestion des fichiers en mémoire
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importe les modèles
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// Crée une instance de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Crée un serveur HTTP pour Express et WebSocket
const server = http.createServer(app);

// Connexion à la base de données MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch((err) => console.error('Erreur de connexion à MongoDB :', err));


// La configuration CORS (pour autoriser les requêtes depuis votre frontend Vercel/localhost)
app.use(cors({
    origin: [
        'http://localhost:5173', // Pour le développement local
        'https://g-house.vercel.app' // L'URL de votre frontend Vercel
        // Ajoutez d'autres origines si nécessaire
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// Middlewares pour parser le JSON et les données de formulaire
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ====================================================================
// 🔑 ROUTES D'AUTHENTIFICATION (Fixent les erreurs 404 et 401)
// ====================================================================

/**
 * Inscription : POST /api/register
 */
app.post('/api/register', async (req, res) => {
    try {
        // Crée un nouvel utilisateur. Le middleware `pre('save')` de User.js hache le mot de passe.
        const newUser = new User(req.body);
        await newUser.save();
        
        // Réponse de succès
        res.status(201).json({ 
            message: 'Inscription réussie. Vous pouvez maintenant vous connecter.', 
            user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
        });
    } catch (error) {
        // Gérer les erreurs (ex: email déjà utilisé - code 11000)
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }
        console.error("Erreur d'inscription:", error);
        res.status(500).json({ message: "Échec de l'inscription." });
    }
});


/**
 * Connexion : POST /api/login
 */
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // 1. Trouver l'utilisateur
        const user = await User.findOne({ email });
        if (!user) {
            // Renvoie 401 (Unauthorized) pour ne pas révéler l'existence de l'email
            return res.status(401).json({ message: 'Identifiants invalides.' }); 
        }

        // 2. Comparer le mot de passe (utilise la méthode bcryptjs)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // Renvoie 401 (Unauthorized)
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // 3. Créer un token JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' } // Le token expire après 24 heures
        );
        
        // 4. Succès : Renvoyer le token et les infos utilisateur
        res.status(200).json({ 
            token, 
            user: { 
                userId: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role 
            } 
        });

    } catch (error) {
        console.error("Erreur de connexion:", error);
        res.status(500).json({ message: "Échec de la connexion." });
    }
});

// ====================================================================
// ROUTES HOUSING (PUBLIQUES ET PROTÉGÉES)
// ====================================================================

/**
 * Récupérer tous les logements (avec filtres) : GET /api/housing
 * NOTE: Cette route est publique (pas de authMiddleware)
 */
app.get('/api/housing', async (req, res) => {
    try {
        const { city, price_min, price_max, type } = req.query;
        const filters = {};

        if (city) filters['location.city'] = new RegExp(city, 'i');
        if (price_min) filters.price = { ...filters.price, $gte: parseInt(price_min) };
        if (price_max) filters.price = { ...filters.price, $lte: parseInt(price_max) };
        if (type) filters.type = type;

        const housing = await Housing.find(filters).populate('landlord', 'name email');
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des logements.' });
    }
});

/**
 * Créer un nouveau logement : POST /api/housing
 */
app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    // La logique de création
    try {
        const { title, description, price, location, type, amenities } = req.body;
        
        // S'assurer que seul un 'landlord' peut créer un logement
        if (req.userData.role !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent créer des annonces.' });
        }
        
        // 1. Upload des images vers Cloudinary
        const imagesUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const uploadResponse = await cloudinary.uploader.upload(dataURI, {
                    folder: 'g-house/housing',
                });
                imagesUrls.push(uploadResponse.secure_url);
            }
        }

        // 2. Créer l'objet logement
        const newHousing = new Housing({
            title,
            description,
            price,
            location: JSON.parse(location), // Location est un objet JSON dans FormData
            type,
            amenities: amenities.split(',').map(a => a.trim()).filter(a => a),
            landlord: req.userData.userId, // ID du propriétaire depuis le token
            images: imagesUrls,
        });

        // 3. Sauvegarder dans la DB
        await newHousing.save();

        res.status(201).json({ 
            message: 'Annonce créée avec succès !', 
            housing: newHousing 
        });

    } catch (error) {
        console.error("Erreur de création d'annonce:", error);
        res.status(500).json({ message: "Échec de la création de l'annonce.", error: error.message });
    }
});

/**
 * Mettre à jour un logement : PUT /api/housing/:id
 */
app.put('/api/housing/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const userId = req.userData.userId;

        // 1. Trouver le logement existant et vérifier les droits
        const existingHousing = await Housing.findById(id);
        if (!existingHousing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        
        // Vérifier que l'utilisateur est le propriétaire de l'annonce
        if (existingHousing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        let imagesUrls = existingHousing.images || [];

        // 2. Gérer le remplacement des images
        if (req.files && req.files.length > 0) {
            // Supprimer les anciennes images (logique optionnelle, mais recommandée pour Cloudinary)
            // ... (logique de suppression Cloudinary)

            // Upload des nouvelles images
            const newImagesUrls = [];
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const uploadResponse = await cloudinary.uploader.upload(dataURI, {
                    folder: 'g-house/housing',
                });
                newImagesUrls.push(uploadResponse.secure_url);
            }
            imagesUrls = newImagesUrls; // Remplacer toutes les images
        }

        // 3. Appliquer les mises à jour
        const updatedFields = {
            ...updateData,
            images: imagesUrls,
        };
        // Gérer les champs JSON (comme location)
        if (updateData.location) {
            updatedFields.location = JSON.parse(updateData.location);
        }
        if (updateData.amenities) {
            updatedFields.amenities = updateData.amenities.split(',').map(a => a.trim()).filter(a => a);
        }

        const updatedHousing = await Housing.findByIdAndUpdate(id, updatedFields, { new: true });

        res.status(200).json({ 
            message: 'Annonce mise à jour avec succès.', 
            housing: updatedHousing 
        });

    } catch (error) {
        console.error("Erreur de mise à jour d'annonce:", error);
        res.status(500).json({ message: "Échec de la mise à jour de l'annonce.", error: error.message });
    }
});

/**
 * Supprimer un logement : DELETE /api/housing/:id
 */
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }

        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        // Suppression des images de Cloudinary (logique à ajouter)
        // ...

        await Housing.findByIdAndDelete(id);
        res.status(200).json({ message: 'Annonce supprimée avec succès.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'annonce.' });
    }
});

/**
 * Récupérer les détails d'un logement : GET /api/housing/:id
 * NOTE: Cette route est publique
 */
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des détails du logement.' });
    }
});

/**
 * Récupérer les logements d'un utilisateur (Landlord Dashboard) : GET /api/user/housing
 */
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const housing = await Housing.find({ landlord: userId });
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des annonces de l\'utilisateur.' });
    }
});

// ====================================================================
// ROUTES BOOKING (RÉSERVATION ET PAIEMENT STRIPE)
// ====================================================================

/**
 * Créer une session de paiement Stripe pour une réservation : POST /api/create-booking-session
 * @requires authMiddleware - Seuls les utilisateurs connectés (locataires) peuvent réserver
 */
app.post('/api/create-booking-session', authMiddleware, async (req, res) => {
    const { housingId, startDate, endDate, pricePerMonth, landlordId } = req.body;
    const tenantId = req.userData.userId;

    // 1. Vérification de base (ex: dates valides, locataire différent du propriétaire)
    if (tenantId === landlordId) {
        return res.status(400).json({ message: 'Vous ne pouvez pas réserver votre propre logement.' });
    }
    
    // Calculer le nombre de jours et le montant total (logic plus robuste est préférable)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Jours pleins
    const pricePerDay = pricePerMonth / 30.0;
    const amount = Math.round(pricePerDay * diffDays * 100); // Montant en centimes

    // 2. Créer l'objet Booking initial dans la DB (statut: 'pending')
    try {
        const newBooking = new Booking({
            housing: housingId,
            tenant: tenantId,
            landlord: landlordId,
            startDate: start,
            endDate: end,
            amount: amount / 100, // Stocker le montant en euros
            status: 'pending',
        });
        await newBooking.save();

        // 3. Créer la session Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Réservation de ${newBooking.housing.title || 'Logement'}`,
                        },
                        unit_amount: amount, 
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URL de redirection après succès et échec
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
            cancel_url: `${process.env.FRONTEND_URL}/housing/${housingId}`,
            
            // Stocker l'ID de la réservation dans les métadonnées Stripe
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: tenantId,
            }
        });

        // 4. Renvoyer l'ID de session au frontend (BookingForm.jsx)
        res.status(200).json({ sessionId: session.id, bookingId: newBooking._id });

    } catch (error) {
        console.error("Erreur Stripe ou DB:", error);
        res.status(500).json({ message: 'Échec de la création de la session de paiement. Vérifiez les logs Stripe et les variables d\'environnement.', error: error.message });
    }
});


/**
 * Webhook Stripe pour gérer les paiements (Statut de 'pending' à 'confirmed')
 * NOTE: Doit être une route brute (sans express.json()) et doit vérifier la signature Stripe
 */
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        // En cas d'erreur de signature ou autre
        console.log(`⚠️ Erreur Webhook Stripe: ${err.message}`);
        return res.status(400).send(`Erreur Webhook: ${err.message}`);
    }

    // Gérer l'événement
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const bookingId = session.metadata.bookingId;

        if (session.payment_status === 'paid' && bookingId) {
            try {
                // Mettre à jour la réservation
                const updatedBooking = await Booking.findByIdAndUpdate(
                    bookingId,
                    { status: 'confirmed' }, // Statut confirmé après paiement réussi
                    { new: true }
                );
                
                // Envoi de notifications ou d'e-mails (logique à implémenter)
                // ...

                console.log(`Réservation ${bookingId} confirmée via Webhook.`);
            } catch (error) {
                console.error('Erreur lors de la mise à jour de la réservation via Webhook:', error);
                // Laisser Stripe réessayer si c'est une erreur temporaire
                return res.status(500).send('Erreur serveur lors de la mise à jour de la DB.');
            }
        }
    }

    // Répondre à Stripe
    res.json({ received: true });
});

/**
 * Récupérer les réservations pour un propriétaire (Dashboard) : GET /api/bookings
 * Récupère toutes les réservations liées aux logements de l'utilisateur connecté
 */
app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        
        // Trouver tous les logements appartenant à l'utilisateur
        const userHousing = await Housing.find({ landlord: userId }).select('_id');
        const housingIds = userHousing.map(h => h._id);

        // Trouver toutes les réservations pour ces logements
        const bookings = await Booking.find({ housing: { $in: housingIds } })
            .populate('housing', 'title') // Populate le titre du logement
            .populate('tenant', 'name email'); // Populate les infos du locataire

        res.status(200).json({ bookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations.' });
    }
});

/**
 * Mettre à jour le statut d'une réservation (Confirmer/Annuler) : PUT /api/bookings/:id/status
 */
app.put('/api/bookings/:id/status', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.userData.userId;

        if (!['confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Statut de réservation invalide.' });
        }
        
        const booking = await Booking.findById(id).populate('housing', 'landlord');

        // Vérification des droits: seul le propriétaire du logement peut modifier le statut
        if (!booking || booking.housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé ou réservation non trouvée.' });
        }
        
        booking.status = status;
        await booking.save();

        // Envoi de notifications ou d'e-mails au locataire (logique à implémenter)
        // ...

        res.status(200).json({ message: `Réservation ${id} mise à jour au statut: ${status}`, booking });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du statut de la réservation.' });
    }
});

// ====================================================================
// ROUTES DOCUMENTS DE PROFIL (UPLOAD)
// ====================================================================

/**
 * Télécharger un document de profil : POST /api/user/documents
 */
app.post('/api/user/documents', authMiddleware, upload.single('document'), async (req, res) => {
    // La logique d'upload de document (similaire à Housing, mais pour ProfileDoc)
    try {
        const { docType } = req.body;
        const userId = req.userData.userId;
        
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier téléchargé.' });
        }

        // Upload vers Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        const uploadResponse = await cloudinary.uploader.upload(dataURI, {
            folder: `g-house/documents/${userId}`, // Dossier par utilisateur
            resource_type: "auto", // Accepte PDF, etc.
        });

        // Mise à jour ou création du document de profil
        const newDoc = await ProfileDoc.findOneAndUpdate(
            { user: userId, docType: docType },
            { 
                docType: docType,
                url: uploadResponse.secure_url,
                uploadedAt: Date.now(),
            },
            { new: true, upsert: true }
        );

        res.status(201).json({ message: `${docType} téléchargé avec succès.`, document: newDoc });
    } catch (error) {
        console.error("Erreur d'upload de document:", error);
        res.status(500).json({ message: "Échec du téléchargement du document." });
    }
});

/**
 * Récupérer les documents de l'utilisateur : GET /api/user/documents
 */
app.get('/api/user/documents', authMiddleware, async (req, res) => {
    try {
        const documents = await ProfileDoc.find({ user: req.userData.userId });
        res.status(200).json({ documents });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des documents.' });
    }
});


// ====================================================================
// ROUTES CONVERSATIONS ET MESSAGERIE
// ====================================================================

/**
 * Démarrer ou retrouver une conversation : POST /api/conversations/start
 */
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { recipientId, housingId } = req.body;
        const senderId = req.userData.userId;

        if (senderId === recipientId) {
            return res.status(400).json({ message: 'Vous ne pouvez pas discuter avec vous-même.' });
        }

        // Tenter de trouver une conversation existante
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
            housing: housingId || null // Si housingId est null, il doit correspondre exactement à null dans la DB
        });

        if (!conversation) {
            // Créer une nouvelle conversation si non trouvée
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId,
                lastMessageAt: Date.now(),
            });
            await conversation.save();
        }

        res.status(200).json({ 
            message: 'Conversation prête.', 
            conversationId: conversation._id 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du démarrage de la conversation.' });
    }
});


/**
 * Récupérer la liste des conversations de l'utilisateur : GET /api/conversations
 */
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        
        const conversations = await Conversation.find({ participants: userId })
            .populate('participants', 'name') // Populate les noms des participants
            .populate('housing', 'title') // Populate le titre du logement
            .sort({ lastMessageAt: -1 });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des conversations.' });
    }
});

/**
 * Récupérer les messages d'une conversation : GET /api/conversations/:id/messages
 */
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
        }
        
        const messages = await Message.find({ conversation: id }).populate('sender', 'name');
        res.status(200).json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des messages.' });
    }
});

// ====================================================================
// WEBSOCKET (MESSAGERIE INSTANTANÉE)
// ====================================================================

// Initialiser le serveur WebSocket sur le même port que le serveur Express/HTTP
const wss = new WebSocket.Server({ server });

// Mappe pour stocker les connexions WebSocket des utilisateurs
const userWsMap = new Map(); // Key: userId (String), Value: WebSocket (Object)

wss.on('connection', (ws, req) => {
    // 1. Authentification (via un paramètre d'URL 'token' pour la WS)
    // NOTE: C'est une méthode simple, un middleware WS plus robuste est conseillé pour la production.
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    let userId = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
            userWsMap.set(userId, ws); // Associer l'ID utilisateur à la connexion WebSocket
            console.log(`Utilisateur connecté via WebSocket: ${userId}`);
        } catch (err) {
            ws.close(1008, 'Token invalide.');
            return;
        }
    } else {
        ws.close(1008, 'Authentification requise.');
        return;
    }

    // 2. Réception de messages
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data;
                
                // Vérification de base (l'utilisateur doit faire partie de la conversation)
                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.includes(userId)) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Accès conversation refusé.' }));
                    return;
                }

                // Créer et sauvegarder le nouveau message
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId,
                    content: content,
                });
                await newMessage.save();

                // Mettre à jour la conversation
                conversation.lastMessageAt = Date.now();
                await conversation.save();

                // 3. Diffuser le message aux deux participants
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    message: {
                        _id: newMessage._id,
                        content: newMessage.content,
                        sender: { _id: userId, name: req.userData.name }, // Si vous avez le nom stocké dans la map
                        createdAt: newMessage.createdAt,
                        conversation: conversationId,
                    }
                };
                
                // Envoyer au destinataire
                const recipientWs = userWsMap.get(recipientId);
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messageToSend));
                }

                // Envoyer à l'expéditeur (pour la confirmation)
                ws.send(JSON.stringify(messageToSend)); 
            }

        } catch (error) {
            console.error('Erreur de traitement de message WebSocket:', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur.' }));
        }
    });

    // 4. Déconnexion
    ws.on('close', () => {
        userWsMap.delete(userId); // Supprimer l'utilisateur de la map
        console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
    });
});

// ----------------------------------------------------\
// FIN DES ROUTES API
// ----------------------------------------------------\

// Route pour la documentation de l'API (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Définition de la route de test (vérification simple)
app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

// Le serveur démarre et écoute sur le port défini
server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});