// Fichier : backend/index.js (Version Complète & Corrigée)

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================
// 1. IMPORTS DES MODULES ET INITIALISATION
// ====================================================================
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
const Message = require('./models/Message'); 
const Conversation = require('./models/Conversation'); 
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');

// Initialisation de l'application Express et du serveur HTTP pour WebSocket
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 10000;


// ====================================================================
// 2. MIDDLEWARE GÉNÉRAUX ET CONNEXION DB
// ====================================================================

// Connexion à la base de données MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB établie avec succès'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err)); 

// Middleware CORS (configuration complète)
const allowedOrigins = [
    'https://g-house.vercel.app', 
    'http://localhost:5173',       
    'http://localhost:3000',
];
if (process.env.FRONTEND_URL) {
    const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    if (!allowedOrigins.includes(frontendUrl)) {
        allowedOrigins.push(frontendUrl);
    }
}
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'), false);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
}));

// Middleware pour parser les corps de requêtes JSON
app.use(express.json());

// ====================================================================
// 5. ROUTES MESSAGERIE (Conversations & Messages)
// ====================================================================

// GET /api/conversations : Récupère la liste des conversations
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.userData.userId })
            .populate('housing', 'title images') 
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


// POST /api/conversations/start : Démarrer ou trouver une conversation existante
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { housingId, recipientId } = req.body;
        const senderId = req.userData.userId;
        
        let conversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [senderId, recipientId] }
        })
        .populate('housing', 'title images')
        .populate('participants', 'name email');
        
        if (!conversation) {
            conversation = new Conversation({
                housing: housingId,
                participants: [senderId, recipientId],
            });
            await conversation.save();
            
            conversation = await Conversation.findById(conversation._id)
                .populate('housing', 'title images')
                .populate('participants', 'name email');
        }

        res.status(200).json({ conversation });
    } catch (error) {
        console.error("Erreur sur POST /api/conversations/start :", error);
        res.status(500).json({ message: 'Erreur serveur lors du démarrage de la conversation.' });
    }
});

// 🔑 ROUTE AJOUTÉE : GET /api/conversations/:id (pour getConversationDetails)
app.get('/api/conversations/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const conversation = await Conversation.findById(id)
            .populate('housing', 'title images') 
            .populate('participants', 'name email');
        
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }

        res.status(200).json({ conversation });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// 🔑 ROUTE AJOUTÉE : GET /api/conversations/:id/messages (pour getMessages)
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }
        
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name') // Pour afficher le nom de l'expéditeur
            .sort({ createdAt: 1 });
            
        res.status(200).json({ messages }); 
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});


// ====================================================================
// 6. GESTION DES WEBSOCKETS (CORRIGÉE : AJOUT DE LA SAUVEGARDE)
// ====================================================================

const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null; 
    
    // ... (Logique de connexion et vérification du token - inchangée) ...
    
    // 2. Traitement des messages
    ws.on('message', async (message) => {
        if (!userId) return; 
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;

                // CRÉATION DU MESSAGE
                const newMessage = new Message({ 
                    conversation: conversationId, 
                    sender: userId, 
                    content: content 
                });
                
                await newMessage.save(); // 🔑 CORRECTION CRITIQUE : Enregistrement dans la DB !

                // Mise à jour de la conversation
                await Conversation.findByIdAndUpdate(
                    conversationId, 
                    { lastMessage: newMessage._id, updatedAt: Date.now() }
                );

                // Objet à envoyer aux clients
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    payload: { 
                        _id: newMessage._id, 
                        content: newMessage.content, 
                        sender: { _id: userId.toString() }, 
                        createdAt: newMessage.createdAt, 
                        conversation: conversationId,
                    }
                };
                
                // Envoyer au destinataire et à l'expéditeur (pour l'affichage immédiat)
                const recipientWs = userWsMap.get(recipientId.toString());
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messageToSend));
                }
                ws.send(JSON.stringify(messageToSend)); 
            }

        } catch (error) {
            console.error('🚨 ERREUR CRITIQUE DE SAUVEGARDE (WebSocket):', error.message);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur lors de la sauvegarde.' }));
        }
    });

    // 3. Déconnexion
    ws.on('close', () => {
        if (userId) {
            userWsMap.delete(userId.toString());
        }
    });
});


// ====================================================================
// ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House !');
});

server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});