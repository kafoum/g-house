// Fichier : backend/index.js (Version Complète & Corrigée)

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================\
// 1. IMPORTS DES MODULES ET INITIALISATION
// ====================================================================\
const authMiddleware = require('./middleware/auth'); // Middleware d'authentification JWT
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); // Fichier de configuration Swagger
const cors = require('cors'); 

// Modules WebSocket
const http = require('http');
const WebSocket = require('ws');

// INITIALISATION DE STRIPE
// 🔑 Assurez-vous que STRIPE_SECRET_KEY est défini dans votre .env
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
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const Notification = require('./models/Notification'); // Nécessaire pour les notifications de réservation

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// ====================================================================\
// 2. MIDDLEWARES GLOBALES
// ====================================================================\

// 🔑 ATTENTION CLÉ : Le webhook Stripe DOIT utiliser le raw body, pas express.json().
// On définit donc la route du webhook avant express.json().
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // 🔑 Vérification de la signature Stripe
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erreur Webhook Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer l'événement `checkout.session.completed`
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { bookingId, tenantId, landlordId } = session.metadata;

        try {
            // 1. Mettre à jour la réservation
            const booking = await Booking.findByIdAndUpdate(
                bookingId,
                { status: 'confirmed' },
                { new: true }
            );

            if (!booking) {
                console.error(`Réservation ID ${bookingId} non trouvée.`);
                return res.status(404).json({ received: true, message: 'Booking not found.' });
            }
            
            // 2. Créer une notification pour le propriétaire (Landlord)
            const notification = new Notification({
                recipient: landlordId,
                message: `Nouvelle réservation confirmée pour ${booking.housing.toString()}.`,
                type: 'booking_confirmed'
            });
            await notification.save();
            
            // 3. Envoyer la notification via WebSocket au propriétaire (si connecté)
            const recipientWs = userWsMap.get(landlordId);
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                 recipientWs.send(JSON.stringify({ 
                    type: 'NEW_NOTIFICATION', 
                    payload: notification 
                 }));
            }

        } catch (error) {
            console.error('Erreur de traitement de l\'événement Webhook:', error);
            return res.status(500).json({ received: false, message: 'Server error processing webhook.' });
        }
    }

    // Réponse standard pour tous les événements traités (ou non)
    res.json({ received: true });
});

// Middleware pour parser les corps de requêtes en JSON (pour toutes les autres routes)
app.use(express.json()); 

// Middleware CORS
// 🔑 Remplacez par votre URL de frontend si nécessaire pour la sécurité
app.use(cors({
    origin: process.env.VERCEL_FRONTEND_URL || 'https://g-house.vercel.app', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));


// ====================================================================\
// 3. CONNEXION À MONGODB
// ====================================================================\

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connecté à MongoDB'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err));


// ====================================================================\
// 4. ROUTES D'AUTHENTIFICATION (Auth)
// ====================================================================\

// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }

        const user = new User({ name, email, password, role });
        await user.save();
        
        // Nettoyer l'objet avant de le renvoyer
        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;

        res.status(201).json({ 
            message: 'Inscription réussie.', 
            user: userWithoutPassword 
        });
    } catch (error) {
        console.error('Erreur d\'inscription:', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // Créer et signer le jeton JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' } // Valide pour 7 jours
        );

        // Nettoyer l'objet avant de le renvoyer
        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;

        res.status(200).json({ 
            message: 'Connexion réussie.', 
            token, 
            user: userWithoutPassword 
        });
    } catch (error) {
        console.error('Erreur de connexion:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});


// ====================================================================\
// 5. ROUTES DE GESTION DES LOGEMENTS (Housing)
// ====================================================================\

// POST /api/housing : CRÉER UN LOGEMENT
app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul un propriétaire peut créer une annonce.' });
    }

    try {
        const { title, description, price, address, city, zipCode, type, amenities } = req.body;
        const files = req.files;
        
        // 1. Upload des fichiers sur Cloudinary
        const imageUploadPromises = files.map(file => {
            // Utilise la base64 du buffer en mémoire
            return cloudinary.uploader.upload(
                `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
            );
        });

        const uploadResults = await Promise.all(imageUploadPromises);
        const imageUrls = uploadResults.map(result => result.secure_url);

        // 2. Création du logement
        const newHousing = new Housing({
            title,
            description,
            price: parseFloat(price),
            location: { address, city, zipCode },
            type,
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            landlord: req.userData.userId,
            images: imageUrls,
        });

        const savedHousing = await newHousing.save();
        res.status(201).json({ 
            message: 'Annonce créée avec succès !', 
            housing: savedHousing 
        });

    } catch (error) {
        console.error('Erreur de création de logement:', error);
        res.status(500).json({ 
            message: 'Erreur serveur lors de la création de l\'annonce.' 
        });
    }
});

// GET /api/housing : RÉCUPÉRER TOUS LES LOGEMENTS (Filtres optionnels)
app.get('/api/housing', async (req, res) => {
    try {
        const { city, price_min, price_max, type } = req.query;
        let query = { status: 'active' }; 

        if (city) query['location.city'] = { $regex: city, $options: 'i' };
        if (type) query.type = type;

        if (price_min || price_max) {
            query.price = {};
            if (price_min) query.price.$gte = parseFloat(price_min);
            if (price_max) query.price.$lte = parseFloat(price_max);
        }

        const housing = await Housing.find(query).populate('landlord', 'name email');
        res.status(200).json({ housing });
    } catch (error) {
        console.error('Erreur de récupération des logements:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// GET /api/housing/:id : RÉCUPÉRER UN LOGEMENT PAR ID
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id)
                                    .populate('landlord', 'name email role'); 
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error('Erreur de récupération du détail:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// GET /api/user/housing : RÉCUPÉRER LES LOGEMENTS DE L'UTILISATEUR CONNECTÉ
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const housing = await Housing.find({ landlord: req.userData.userId });
        res.status(200).json({ housing });
    } catch (error) {
        console.error('Erreur de récupération des annonces utilisateur:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// PUT /api/housing/:id : METTRE À JOUR UN LOGEMENT
app.put('/api/housing/:id', authMiddleware, async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé.' });
    }
    
    try {
        // NOTE: La gestion de l'upload d'images est complexe ici, on suppose que la requête 
        // ne contient que les champs texte. Pour la version complète, vous devriez gérer Multer/Cloudinary ici aussi.
        const updatedHousing = await Housing.findOneAndUpdate(
            { _id: req.params.id, landlord: req.userData.userId }, 
            req.body, 
            { new: true, runValidators: true }
        );

        if (!updatedHousing) {
            return res.status(404).json({ message: 'Annonce non trouvée ou accès refusé.' });
        }
        
        res.status(200).json({ 
            message: 'Annonce mise à jour avec succès.', 
            housing: updatedHousing 
        });

    } catch (error) {
        console.error('Erreur de mise à jour de logement:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// DELETE /api/housing/:id : SUPPRIMER UN LOGEMENT
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul un propriétaire peut supprimer une annonce.' });
    }

    try {
        const result = await Housing.findOneAndDelete({ 
            _id: req.params.id, 
            landlord: req.userData.userId 
        });

        if (!result) {
            return res.status(404).json({ message: 'Annonce non trouvée ou accès refusé.' });
        }
        
        // 🔑 Idéalement, supprimer les images Cloudinary ici

        res.status(200).json({ message: 'Annonce supprimée avec succès.' });
    } catch (error) {
        console.error('Erreur de suppression de logement:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================\
// 6. ROUTES DE MESSAGERIE (Conversations & Messages)
// ====================================================================\

// POST /api/conversations/start : DÉMARRER OU RÉCUPÉRER UNE CONVERSATION
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { housingId, recipientId } = req.body;
        const senderId = req.userData.userId;

        if (!housingId || !recipientId) {
            return res.status(400).json({ message: 'L\'ID du logement et du destinataire sont requis.' });
        }
        if (senderId.toString() === recipientId.toString()) {
            return res.status(400).json({ message: 'Vous ne pouvez pas démarrer une conversation avec vous-même.' });
        }

        // 1. Chercher une conversation existante
        let conversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [senderId, recipientId] }
        })
        .populate('participants', 'name email role')
        .populate('housing', 'title');

        if (conversation) {
            return res.status(200).json({ 
                message: 'Conversation existante récupérée.', 
                conversation 
            });
        }

        // 2. Créer une nouvelle conversation
        const newConversation = new Conversation({
            housing: housingId,
            participants: [senderId, recipientId]
        });

        const savedConversation = await newConversation.save();
        
        const populatedConversation = await Conversation.findById(savedConversation._id)
            .populate('participants', 'name email role')
            .populate('housing', 'title');

        res.status(201).json({ 
            message: 'Nouvelle conversation démarrée.', 
            conversation: populatedConversation 
        });

    } catch (error) {
        console.error('Erreur lors du démarrage/récupération de la conversation:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// GET /api/conversations : LISTER TOUTES LES CONVERSATIONS DE L'UTILISATEUR
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        
        const conversations = await Conversation.find({
            participants: userId
        })
        .populate('participants', 'name email role')
        .populate('housing', 'title')
        .populate({
            path: 'lastMessage',
            populate: { path: 'sender', select: 'name' }
        })
        .sort({ updatedAt: -1 });

        res.status(200).json({ conversations });

    } catch (error) {
        console.error('Erreur lors de la récupération de la liste de conversations:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// GET /api/conversations/:id/messages : RÉCUPÉRER L'HISTORIQUE DE MESSAGES
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const conversationId = req.params.id;
        const userId = req.userData.userId;

        // 1. Vérifier que l'utilisateur est bien un participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé ou conversation non trouvée.' });
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


// ====================================================================\
// 7. ROUTES DE RÉSERVATION ET PAIEMENT (Booking & Stripe)
// ====================================================================\

// POST /api/bookings/create-checkout-session : CRÉER LA SESSION DE PAIEMENT STRIPE
app.post('/api/bookings/create-checkout-session', authMiddleware, async (req, res) => {
    if (req.userData.role !== 'tenant') {
        return res.status(403).json({ message: 'Accès refusé. Seul un locataire peut effectuer une réservation.' });
    }

    try {
        const { housingId, startDate, endDate, price } = req.body;
        const userId = req.userData.userId;

        if (!housingId || !startDate || !endDate || !price) {
            return res.status(400).json({ message: 'Données de réservation incomplètes.' });
        }

        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        
        // 1. Création de la réservation temporaire (statut 'pending')
        const newBooking = new Booking({
            tenant: userId,
            housing: housingId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: 'pending' 
        });
        const savedBooking = await newBooking.save();
        
        // 2. Création de la session Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Réservation: ${housing.title}`,
                            description: `Du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`
                        },
                        unit_amount: Math.round(price * 100), // En centimes
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URL de redirection
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${savedBooking._id}`,
            cancel_url: `${process.env.FRONTEND_URL}/housing/${housingId}?cancel=true`,
            metadata: {
                bookingId: savedBooking._id.toString(),
                tenantId: userId.toString(),
                landlordId: housing.landlord.toString()
            }
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error('Erreur lors de la création de la session Stripe:', error);
        res.status(500).json({ message: 'Erreur serveur lors du paiement.' });
    }
});


// GET /api/user/bookings : RÉCUPÉRER LES RÉSERVATIONS
app.get('/api/user/bookings', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const role = req.userData.role;
        
        let query = {};
        
        if (role === 'tenant') {
            query.tenant = userId;
        } else if (role === 'landlord') {
            const housingOwned = await Housing.find({ landlord: userId }).select('_id');
            const housingIds = housingOwned.map(h => h._id);
            query.housing = { $in: housingIds };
        } else {
             return res.status(403).json({ message: 'Rôle non géré pour les réservations.' });
        }

        const bookings = await Booking.find(query)
            .populate('housing', 'title')
            .populate('tenant', 'name email'); 

        res.status(200).json({ bookings });

    } catch (error) {
        console.error('Erreur lors de la récupération des réservations:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// PUT /api/user/bookings/:id/status : METTRE À JOUR LE STATUT (Landlord uniquement)
app.put('/api/user/bookings/:id/status', authMiddleware, async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé.' });
    }

    try {
        const bookingId = req.params.id;
        const { status } = req.body;
        const userId = req.userData.userId;

        if (!['confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        const booking = await Booking.findById(bookingId).populate('housing');
        
        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        if (booking.housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette réservation.' });
        }
        
        // Mise à jour du statut
        booking.status = status;
        await booking.save();
        
        // Créer et envoyer une notification au locataire
        const notification = new Notification({
            recipient: booking.tenant,
            message: `Votre réservation pour ${booking.housing.title} a été ${status === 'confirmed' ? 'confirmée' : 'annulée'}.`,
            type: status === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled'
        });
        await notification.save();
        
        const tenantWs = userWsMap.get(booking.tenant.toString());
        if (tenantWs && tenantWs.readyState === WebSocket.OPEN) {
             tenantWs.send(JSON.stringify({ 
                type: 'NEW_NOTIFICATION', 
                payload: notification 
             }));
        }

        res.status(200).json({ message: `Statut de la réservation mis à jour en '${status}'.`, booking });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut de réservation:', error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================\
// 8. INITIALISATION DU WEBSOCKET (Chat en Temps Réel)
// ====================================================================\

// Crée le serveur HTTP et attache Express
const server = http.createServer(app); 
// Crée le serveur WebSocket et l'attache au serveur HTTP existant
const wss = new WebSocket.Server({ server }); 

// Map pour stocker les connexions WebSocket par ID utilisateur
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null; 
    // Récupération du token via les paramètres d'URL (ex: ws://localhost:3000?token=...)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token'); 

    // 🔑 Logique d'authentification du WebSocket
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId.toString();
            
            // Stocker la connexion utilisateur
            userWsMap.set(userId, ws); 
            console.log(`WebSocket connecté pour l'utilisateur: ${userId}`);

        } catch (err) {
            console.error('Erreur de validation de token WebSocket:', err.message);
            ws.close(1008, 'Unauthorized'); 
            return;
        }
    } else {
        ws.close(1008, 'Unauthorized - No Token');
        return;
    }

    // --- Gestion des messages ---
    ws.on('message', async (message) => {
        let parsedMessage;
        try {
            parsedMessage = JSON.parse(message.toString());
        } catch (e) {
            return;
        }

        if (parsedMessage.type === 'SEND_MESSAGE' && userId) {
            const { conversationId, content } = parsedMessage;

            if (!conversationId || !content.trim()) return;

            try {
                // 1. Sauvegarder le message en BDD
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId, 
                    content: content.trim(),
                });
                await newMessage.save();

                // 2. Mettre à jour la conversation
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;

                conversation.lastMessage = newMessage._id;
                await conversation.save();

                // 3. Identifier le destinataire
                const recipientId = conversation.participants.find(id => id.toString() !== userId);
                if (!recipientId) return;
                
                // 4. Préparer l'objet à envoyer au front
                const messageToSend = {
                    type: 'NEW_MESSAGE',
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

            } catch (error) {
                console.error('Erreur de traitement de message WebSocket:', error);
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur.' }));
            }
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


// ====================================================================\
// 9. ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================\

// Documentation API (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House !');
});

// Démarrage du serveur HTTP (qui écoute aussi le WebSocket)
server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});