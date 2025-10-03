// Fichier : backend/index.js (Version Complète & Corrigée avec vos variables)

// Charge les variables d'environnement depuis le fichier .env
// Cette ligne est cruciale en développement local. En production, l'hébergeur (Vercel, Render) injecte les variables.
require('dotenv').config();

// ====================================================================\\
// 1. IMPORTS DES MODULES ET INITIALISATION
// ====================================================================\\
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

// 🔑 CONFIGURATION CLÉ : Base de données, Ports et URL Frontend
const PORT = process.env.PORT || 5000;
// Utilise VERCEL_FRONTEND_URL ou l'URL fournie comme valeur de secours
const FRONTEND_URL = process.env.VERCEL_FRONTEND_URL || 'https://g-house.vercel.app'; 

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
const Notification = require('./models/Notification');
const ProfileDoc = require('./models/ProfileDoc'); // Nouveau modèle pour les documents

// Initialisation d'Express
const app = express();
// Crée un serveur HTTP standard pour Express ET le WebSocket
const server = http.createServer(app);


// ====================================================================\\
// 2. CONNEXION À LA BASE DE DONNÉES
// ====================================================================\\

// 🔑 CLÉ : Utilisation de MONGODB_URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connexion à MongoDB réussie !'))
.catch(error => console.error('Connexion à MongoDB échouée !', error));


// ====================================================================\\
// 3. MIDDLEWARE GÉRAUX ET CORS
// ====================================================================\\

app.use(express.json()); // Permet à Express de lire le JSON

// 🔑 CLÉ : Configuration CORS avec l'URL Frontend
const corsOptions = {
    // 🔑 Utilisation de la variable FRONTEND_URL pour l'origine
    origin: FRONTEND_URL, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Important pour les cookies/sessions (pas utilisé ici, mais bonne pratique)
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));


// ====================================================================\\
// 4. IMPORTS DES ROUTES (API)
// ====================================================================\\

// Importez vos fichiers de routes ici si vous les avez modularisés. 
// Exemple (à décommenter si vos routes sont dans des fichiers séparés) :
// const userRoutes = require('./routes/user');
// app.use('/api/users', userRoutes);

// Pour l'exemple, nous allons directement ajouter les routes dans cette version
// (Dans une vraie application, il faudrait modulariser)
const authRoutes = require('./routes/auth'); // Assurez-vous que ce fichier existe
const housingRoutes = require('./routes/housing'); // Assurez-vous que ce fichier existe
const bookingRoutes = require('./routes/booking'); // Assurez-vous que ce fichier existe
const conversationRoutes = require('./routes/conversation'); // Assurez-vous que ce fichier existe
const paymentRoutes = require('./routes/payment'); // Assurez-vous que ce fichier existe

app.use('/api', authRoutes);
app.use('/api/housing', housingRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/payments', paymentRoutes);


// ====================================================================\\
// 5. WEBHOOK STRIPE
// ====================================================================\\

// !!! ATTENTION : Le middleware express.json() ne doit PAS s'appliquer au webhook !!!
// Le webhook doit lire le corps de la requête sous forme brute (raw)
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    // 🔑 Assurez-vous que STRIPE_WEBHOOK_SECRET est défini dans votre .env
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET; 

    if (!webhookSecret) {
        return res.status(500).send({ message: 'Clé Webhook Stripe manquante.' });
    }

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log(`⚠️ Erreur de vérification du Webhook : ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Traiter l'événement
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const bookingId = session.metadata.bookingId;

        console.log(`✅ Session de paiement complétée pour la réservation ID: ${bookingId}`);

        try {
            // Mettre à jour le statut de la réservation dans la base de données
            const updatedBooking = await Booking.findByIdAndUpdate(bookingId, 
                { status: 'confirmed' }, 
                { new: true }
            );

            if (updatedBooking) {
                console.log(`Réservation ${bookingId} confirmée.`);
                
                // 🔔 Logique pour notifier le propriétaire si nécessaire (via WebSocket ou BDD)
            } else {
                console.error(`Réservation non trouvée pour l'ID: ${bookingId}`);
            }

        } catch (error) {
            console.error('Erreur lors de la mise à jour de la réservation après paiement:', error);
            // On renvoie 200 à Stripe même en cas d'erreur interne pour ne pas re-tenter
        }
    }

    res.status(200).json({ received: true });
});

// ====================================================================\\
// 6. INITIALISATION DU WEBSOCKET (MESSAGERIE)
// ====================================================================\\

const wss = new WebSocket.Server({ 
    server,
    // 🔑 Permet uniquement les connexions depuis l'URL du frontend
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
// 🔑 Assurez-vous que JWT_SECRET est défini dans votre .env
const JWT_SECRET = process.env.JWT_SECRET; 

wss.on('connection', (ws, req) => {
    let userId = null;
    
    // 1. Authentification de la connexion WebSocket via le token JWT
    // Le token est passé dans le chemin de la requête (e.g., /?token=...)
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
        
        const data = JSON.parse(message.toString());

        if (data.type === 'NEW_MESSAGE' && data.content && data.conversationId && data.recipientId) {
            try {
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
                ).populate('participants', 'name'); // Optionnel, pour le log

                if (!conversation) {
                    console.error('Conversation non trouvée:', conversationId);
                    return;
                }
                
                // Préparer l'objet message à envoyer aux clients
                const messageToSend = {
                    type: 'MESSAGE_RECEIVED',
                    payload: {
                        _id: newMessage._id, 
                        content: newMessage.content, 
                        // IMPORTANT : Le frontend utilise user.userId pour l'expéditeur, on envoie donc le format minimal pour identification
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


// ====================================================================\\
// 9. ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================\\

// Documentation API (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House !');
});

// Démarrage du serveur HTTP (qui écoute aussi le WebSocket)
server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});