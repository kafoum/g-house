// Fichier : backend/index.js

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
const nodemailer = require('nodemailer'); // Pour les emails (confirmation, etc.)
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); // Assurez-vous d'avoir ce fichier
const cors = require('cors'); 

// Modules WebSocket
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

// Configurez Multer pour la gestion des fichiers en mémoire (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importe les modèles Mongoose (Assurez-vous qu'ils existent dans le dossier models)
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');


// ====================================================================
// 2. CONFIGURATION ET CONNEXION À LA BASE DE DONNÉES
// ====================================================================
const app = express();
const server = http.createServer(app); 
const PORT = process.env.PORT || 10000;
const DB_URI = process.env.MONGO_URI; 

// Middleware CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Remplacez par votre URL Vercel en prod
    credentials: true,
}));

// Middleware pour analyser le corps des requêtes JSON (doit être AVANT les routes)
// Note: Stripe webhook doit être AVANT body-parser (voir ci-dessous)


// Connexion à MongoDB
if (!DB_URI) {
    console.error("FATAL ERROR: La variable d'environnement MONGO_URI n'est pas définie !");
    process.exit(1); 
}

mongoose.connect(DB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(err => console.error('Erreur de connexion à MongoDB :', err));


// ====================================================================
// 3. FONCTIONS UTILITAIRES CLOUDINARY
// ====================================================================

/**
 * Uploade les fichiers Multer sur Cloudinary.
 * @param {Array<Express.Multer.File>} files - Tableau de fichiers Multer
 * @returns {Promise<Array<string>>} - Tableau des URLs sécurisées
 */
const uploadImagesToCloudinary = async (files) => {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map(file => {
        const b64 = Buffer.from(file.buffer).toString("base64");
        let dataURI = "data:" + file.mimetype + ";base64," + b64;
        return cloudinary.uploader.upload(dataURI, {
            folder: "g-house-housing-images", 
            resource_type: "auto", 
        }).then(result => result.secure_url); 
    });

    return Promise.all(uploadPromises);
};


// ====================================================================
// 4. ROUTE WEBHOOK STRIPE (DOIT UTILISER LE RAW BODY AVANT app.use(express.json()))
// ====================================================================

app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // Remplacez 'WH_SECRET' par la vraie clé secrète du webhook
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Erreur de signature Webhook Stripe:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer l'événement de Stripe
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { bookingId } = session.metadata;

        if (bookingId) {
            try {
                // Mettre à jour la réservation comme payée (status 'confirmed')
                const updatedBooking = await Booking.findByIdAndUpdate(
                    bookingId,
                    { 
                        status: 'confirmed', 
                        paymentIntentId: session.payment_intent,
                        totalPrice: session.amount_total / 100, // En centimes, donc diviser
                        paymentDate: new Date()
                    },
                    { new: true }
                );

                if (updatedBooking) {
                    console.log(`Réservation ${bookingId} confirmée et payée.`);
                    
                    // TODO: Envoyer une notification au propriétaire et au locataire
                }
            } catch (error) {
                console.error('Erreur lors de la mise à jour de la réservation après paiement:', error);
                return res.status(500).json({ received: true, error: "Database update failed" });
            }
        }
    }

    res.json({ received: true });
});


// Middleware pour parser les corps JSON (après le webhook)
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 


// ====================================================================
// 5. ROUTES AUTHENTIFICATION (USER)
// ====================================================================

// Route d'inscription
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }
        
        // Créer l'utilisateur (le middleware `pre('save')` s'occupe du hachage)
        const newUser = new User({ name, email, password, role });
        await newUser.save();

        res.status(201).json({ message: 'Inscription réussie. Vous pouvez maintenant vous connecter.' });
    } catch (error) {
        console.error(error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: `Erreur de validation: ${Object.values(error.errors).map(val => val.message).join('. ')}` });
        }
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
    }
});

// Route de connexion
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // Comparer le mot de passe haché
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // Créer le token JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role }, // Payload corrigé
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({ 
            token, 
            user: {
                id: user._id, // Assurez-vous d'utiliser _id
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});


// ====================================================================
// 6. ROUTES LOGEMENTS (HOUSING)
// ====================================================================

// Route de création de logement (Correction Landlord/Owner)
app.post('/api/housing', authMiddleware, upload.array('images', 10), async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Seul un propriétaire peut créer une annonce.' });
        }

        // Récupérer et parser la chaîne JSON des données du formulaire
        const { data } = req.body;
        if (!data) {
             return res.status(400).json({ message: 'Les données du logement sont manquantes dans la requête.' });
        }
        
        let housingData;
        try {
            housingData = JSON.parse(data); // Contient l'objet location imbriqué
        } catch (e) {
            return res.status(400).json({ message: 'Format des données invalide.' });
        }
        
        // 🔑 CORRECTION MAJEURE: Assigner l'ID à la propriété 'landlord'
        housingData.landlord = req.userData.userId; 

        // Gérer l'upload des images
        if (req.files && req.files.length > 0) {
            const uploadedImageUrls = await uploadImagesToCloudinary(req.files); 
            housingData.images = uploadedImageUrls;
        }

        const newHousing = new Housing(housingData);
        await newHousing.save();

        res.status(201).json({ 
            message: 'Annonce créée avec succès.', 
            housing: newHousing 
        });

    } catch (error) {
        console.error("Erreur sur POST /api/housing :", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message).join('. ');
            return res.status(400).json({ message: `Erreur de validation: ${messages}` });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la création de l\'annonce.' });
    }
});

// Route de modification de logement (Correction Landlord/Owner)
app.put('/api/housing/:id', authMiddleware, upload.array('images', 10), async (req, res) => {
    try {
        const housingId = req.params.id;
        const userId = req.userData.userId;

        // 🔑 CORRECTION: Vérifier si l'utilisateur est le propriétaire de l'annonce en utilisant 'landlord'
        let housing = await Housing.findOne({ _id: housingId, landlord: userId });
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée ou accès refusé.' });
        }

        // Récupérer et parser la chaîne JSON des données du formulaire
        const { data } = req.body;
        if (!data) {
             return res.status(400).json({ message: 'Les données du logement sont manquantes.' });
        }
        
        let housingData;
        try {
            housingData = JSON.parse(data); // Contient l'objet location imbriqué
        } catch (e) {
            return res.status(400).json({ message: 'Format des données invalide.' });
        }
        
        // Gérer l'upload des nouvelles images (remplace les anciennes si de nouvelles sont uploadées)
        if (req.files && req.files.length > 0) {
            const uploadedImageUrls = await uploadImagesToCloudinary(req.files); 
            housingData.images = uploadedImageUrls; // Remplacer le tableau d'images
        } else if (!housingData.images || housingData.images.length === 0) {
            // S'assurer que le champ images existe même s'il est vide
            housingData.images = housing.images;
        }

        // Mettre à jour l'annonce
        const updatedHousing = await Housing.findByIdAndUpdate(
            housingId, 
            { $set: housingData }, 
            { new: true, runValidators: true } // runValidators: pour forcer la validation Mongoose
        );

        res.status(200).json({ 
            message: 'Annonce mise à jour avec succès.', 
            housing: updatedHousing 
        });

    } catch (error) {
        console.error("Erreur sur PUT /api/housing/:id :", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message).join('. ');
            return res.status(400).json({ message: `Erreur de validation: ${messages}` });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'annonce.' });
    }
});


// Route pour obtenir les logements du propriétaire connecté (Correction Landlord/Owner)
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const userRole = req.userData.userRole;

        if (userRole !== 'landlord') {
            return res.status(403).json({ message: 'Seul un propriétaire peut accéder à cette ressource.' });
        }

        // 🔑 CORRECTION: Chercher par 'landlord' et peupler le champ 'landlord'
        const housing = await Housing.find({ landlord: userId }).populate('landlord', 'name email');
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/user/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des logements.' });
    }
});

// Route pour obtenir les détails d'un logement (Correction Landlord/Owner)
app.get('/api/housing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // 🔑 CORRECTION: Peupler le champ 'landlord'
        const housing = await Housing.findById(id).populate('landlord', 'name email role');

        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route pour lister tous les logements (pour la page d'accueil)
app.get('/api/housing', async (req, res) => {
    try {
        // Peupler le champ 'landlord' pour l'affichage du nom du propriétaire
        const housing = await Housing.find({ status: 'active' }).populate('landlord', 'name');
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route de suppression de logement (Correction Landlord/Owner)
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const housingId = req.params.id;
        const userId = req.userData.userId;

        // 🔑 CORRECTION: Chercher et supprimer le logement en utilisant 'landlord'
        const result = await Housing.findOneAndDelete({ _id: housingId, landlord: userId });

        if (!result) {
            return res.status(404).json({ message: 'Annonce non trouvée ou accès refusé.' });
        }

        res.status(200).json({ message: 'Annonce supprimée avec succès.' });

    } catch (error) {
        console.error("Erreur sur DELETE /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 7. ROUTES RÉSERVATIONS (BOOKINGS)
// ====================================================================

// Route pour créer une session de paiement Stripe (Correction Landlord/Owner)
app.post('/api/bookings/create-session', authMiddleware, async (req, res) => {
    const { housingId, startDate, endDate } = req.body;
    const tenantId = req.userData.userId;

    try {
        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        
        // 1. Calculer le prix total (cette logique DOIT être sur le serveur)
        const dateStart = new Date(startDate);
        const dateEnd = new Date(endDate);
        if (dateEnd <= dateStart) {
            return res.status(400).json({ message: 'La date de fin doit être après la date de début.' });
        }
        
        const diffTime = Math.abs(dateEnd.getTime() - dateStart.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const pricePerDay = housing.price / 30.0; 
        const totalPrice = Math.ceil(pricePerDay * diffDays); // Prix total en euros, arrondi à l'entier supérieur

        // 2. Créer la réservation initiale dans la DB avec statut 'pending'
        const newBooking = new Booking({
            tenant: tenantId,
            housing: housingId,
            // 🔑 CORRECTION: Utiliser housing.landlord pour assigner l'ID du propriétaire
            landlord: housing.landlord, 
            startDate: dateStart,
            endDate: dateEnd,
            totalPrice: totalPrice, // Le prix exact calculé par le serveur
            status: 'pending',
        });
        await newBooking.save();

        // 3. Créer la session Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: housing.title,
                        description: `Réservation du ${startDate} au ${endDate}.`,
                    },
                    unit_amount: totalPrice * 100, // Stripe attend le montant en centimes
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/housing/${housingId}`,
            // IMPORTANT: Stocker l'ID de la réservation dans les metadata pour le webhook
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: tenantId.toString(),
            },
        });

        res.json({ id: session.id, bookingId: newBooking._id });

    } catch (error) {
        console.error("Erreur sur POST /api/bookings/create-session :", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message).join('. ');
            return res.status(400).json({ message: `Erreur de validation: ${messages}` });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la création de la session de paiement.' });
    }
});

// Route pour récupérer les réservations (pour locataire OU propriétaire)
app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const userRole = req.userData.userRole;

        let query = {};
        if (userRole === 'tenant') {
            query = { tenant: userId };
        } else if (userRole === 'landlord') {
            // Le propriétaire voit toutes les réservations pour ses logements
            query = { landlord: userId }; 
        }

        const bookings = await Booking.find(query)
            .populate('housing', 'title images price') // Logement
            .populate('tenant', 'name email') // Locataire
            .populate('landlord', 'name email'); // Propriétaire

        res.status(200).json({ bookings });
    } catch (error) {
        console.error("Erreur sur GET /api/bookings :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route pour mettre à jour le statut d'une réservation (Propriétaire uniquement)
app.put('/api/bookings/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body;
    const bookingId = req.params.id;
    const userId = req.userData.userId;

    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seul le propriétaire peut modifier le statut.' });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking || booking.landlord.toString() !== userId) {
            return res.status(404).json({ message: 'Réservation non trouvée ou accès non autorisé.' });
        }
        
        // Seules les réservations en 'pending' peuvent être confirmées/annulées par le propriétaire
        // et seulement si le paiement a été effectué via le webhook (status 'confirmed').
        if (booking.status !== 'pending' && booking.status !== 'confirmed') {
             return res.status(400).json({ message: `Le statut actuel (${booking.status}) ne peut pas être modifié manuellement.` });
        }

        if (status === 'confirmed' || status === 'cancelled') {
            const updatedBooking = await Booking.findByIdAndUpdate(
                bookingId, 
                { status }, 
                { new: true, runValidators: true }
            );

            // TODO: Envoyer une notification au locataire
            
            res.status(200).json({ message: `Statut mis à jour à ${status}.`, booking: updatedBooking });
        } else {
            return res.status(400).json({ message: 'Statut de réservation non valide.' });
        }

    } catch (error) {
        console.error("Erreur sur PUT /api/bookings/:id/status :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 8. ROUTES MESSAGERIE (CONVERSATIONS)
// ====================================================================

// Route pour récupérer les conversations de l'utilisateur
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;

        const conversations = await Conversation.find({ participants: userId })
            .populate('housing', 'title') 
            .populate('participants', 'name email') 
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

// Route pour commencer ou récupérer une conversation existante
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    const { recipientId, housingId } = req.body;
    const senderId = req.userData.userId;

    try {
        if (senderId === recipientId) {
            return res.status(400).json({ message: 'Vous ne pouvez pas démarrer une conversation avec vous-même.' });
        }

        // 1. Chercher si une conversation existe déjà pour ces deux utilisateurs et ce logement
        let conversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [senderId, recipientId] }
        });

        if (conversation) {
            // Conversation existante trouvée
            return res.status(200).json({ conversation });
        }

        // 2. Créer une nouvelle conversation
        const newConversation = new Conversation({
            participants: [senderId, recipientId],
            housing: housingId
        });
        await newConversation.save();

        res.status(201).json({ conversation: newConversation });

    } catch (error) {
        console.error("Erreur sur POST /api/conversations/start :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de la conversation.' });
    }
});

// Route pour récupérer les messages d'une conversation
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
        }
        
        const messages = await Message.find({ conversation: id }).populate('sender', 'name');
        res.status(200).json({ messages });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});


// ====================================================================
// 9. GESTION DES WEBSOCKETS (MESSAGERIE INSTANTANÉE)
// ====================================================================

// Créer l'instance WebSocket server attachée au serveur HTTP
const wss = new WebSocket.Server({ server });

// Map pour associer userId et l'instance WebSocket
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null;
    
    // 1. Authentification via le query param (après la connexion)
    // Le client doit envoyer un message initial de type 'AUTH' avec le token
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.type === 'AUTH') {
                const token = data.token;
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    userId = decoded.userId;
                    userWsMap.set(userId, ws);
                    console.log(`Utilisateur connecté via WebSocket: ${userId}`);
                    ws.send(JSON.stringify({ type: 'STATUS', message: 'Authentification WebSocket réussie.' }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Token invalide.' }));
                    ws.close();
                }
                return;
            }

            // 2. Vérification de l'authentification pour les messages suivants
            if (!userId) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Non authentifié.' }));
                return;
            }

            // 3. Traitement du message
            if (data.type === 'SEND_MESSAGE' && data.conversationId && data.content) {
                const { conversationId, content } = data;
                
                const conversation = await Conversation.findById(conversationId);
                if (!conversation) return;

                // Trouver l'autre participant
                const recipientId = conversation.participants.find(p => p.toString() !== userId);
                if (!recipientId) return;

                // Sauvegarder le message dans la DB
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId,
                    content: content
                });
                await newMessage.save();

                // Mettre à jour la conversation
                conversation.lastMessage = newMessage._id;
                conversation.updatedAt = Date.now();
                await conversation.save();

                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    message: {
                        _id: newMessage._id,
                        content: newMessage.content,
                        // Note: L'info du sender devra être récupérée du contexte côté client/WebSocket
                        conversation: conversationId,
                        createdAt: newMessage.createdAt,
                    }
                };
                
                // Envoyer au destinataire
                const recipientWs = userWsMap.get(recipientId.toString());
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
        if (userId) {
            userWsMap.delete(userId); // Supprimer l'utilisateur de la map
            console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
        }
    });
});


// ----------------------------------------------------
// FIN DES ROUTES API
// ----------------------------------------------------

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