// Fichier : backend/index.js (Version Stable et Complète - Correction du format de Housing)

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

// Configuration Multer
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

// Middleware CORS
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
// 3. ROUTES D'AUTHENTIFICATION
// ====================================================================

// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const lowerCaseRole = role.toLowerCase().trim();
        if (lowerCaseRole !== 'tenant' && lowerCaseRole !== 'landlord') {
             return res.status(400).json({ message: 'Rôle non valide.' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }
        const newUser = new User({ name, email, password, role: lowerCaseRole });
        await newUser.save();
        res.status(201).json({ message: 'Inscription réussie.' });
    } catch (error) {
        console.error("Erreur d'inscription:", error);
        res.status(500).json({ message: "Erreur serveur interne lors de l'inscription." });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Identifiants invalides.' }); 
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            token,
            user: { userId: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error("Erreur dans /api/login:", error);
        res.status(500).json({ message: "Erreur serveur interne lors de la connexion." });
    }
});


// ====================================================================
// 4. ROUTES LOGEMENTS (HOUSING)
// ====================================================================

// 🔑 CORRECTION FINALE : Envoi de l'objet { housings: [...] } pour le front-end
app.get('/api/housing', async (req, res) => {
    try {
        const { city, price_min, price_max, type } = req.query;
        let query = {};

        if (city) query['location.city'] = new RegExp(city, 'i');
        if (type) query.type = type;
        if (price_min || price_max) {
            query.price = {};
            if (price_min) query.price.$gte = parseInt(price_min);
            if (price_max) query.price.$lte = parseInt(price_max);
        }

        const housings = await Housing.find(query)
            .populate('landlord', 'name email')
            .sort({ createdAt: -1 });

        // CLÉ : Le front-end s'attend à `response.data.housings` (objet enveloppant)
        res.status(200).json({ housings }); 

    } catch (error) {
        console.error("Erreur sur GET /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des annonces.' });
    }
});


// GET /api/housing/:id 
app.get('/api/housing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const housing = await Housing.findById(id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// ... (Ajoutez ici vos autres routes Housing : POST, PUT, DELETE) ...


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


// GET /api/conversations/:id/messages : Récupérer les messages d'une conversation (HISTORIQUE)
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }
        
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name') 
            .sort({ createdAt: 1 });
            
        res.status(200).json({ messages }); 
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});


// ====================================================================
// 6. GESTION DES WEBSOCKETS (CLÉ DE LA CORRECTION MESSAGERIE)
// ====================================================================

const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null; 
    
    // 1. Logique de vérification du token et d'affectation de userId
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
            userWsMap.set(userId.toString(), ws);
        } catch (err) {
            console.error("Token WebSocket invalide:", err.message);
            ws.close(1008, 'Token invalide'); 
            return;
        }
    }
    
    // 2. Traitement des messages
    ws.on('message', async (message) => {
        if (!userId) return; 
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;

                // Enregistrement du message en base de données
                const newMessage = new Message({ 
                    conversation: conversationId, 
                    sender: userId, 
                    content: content 
                });
                
                await newMessage.save(); // SAUVEGARDE CRITIQUE

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
                
                // Envoyer au destinataire et à l'expéditeur
                const recipientWs = userWsMap.get(recipientId.toString());
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messageToSend));
                }
                ws.send(JSON.stringify(messageToSend)); 

            }

        } catch (error) {
            // Log de débogage détaillé pour les erreurs Mongoose (pour la messagerie)
            console.error('🚨 ERREUR CRITIQUE DE SAUVEGARDE (WebSocket):', error.message);
            if (error.name === 'ValidationError') {
                console.error('Champs de validation Mongoose manquants:', Object.keys(error.errors));
            }
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