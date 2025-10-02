// Fichier : backend/index.js (Version Complète & Stabilité Maximale)

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
const Message = require('./models/Message'); // 🔑 CLÉ : Doit être importé
const Conversation = require('./models/Conversation'); // 🔑 CLÉ : Doit être importé
// ... autres modèles (ProfileDoc, Notification)

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
        console.warn(`CORS Error: Origin ${origin} not allowed.`);
        return callback(new Error('Not allowed by CORS'), false);
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
}));

// Middleware pour parser les corps de requêtes JSON
app.use(express.json());


// ====================================================================
// 3. ROUTES D'AUTHENTIFICATION (Stables)
// ====================================================================

// POST /api/register (Logique inchangée)
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

// POST /api/login (Stable)
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
// 4. ROUTES LOGEMENTS & CONVERSATIONS (Clés pour l'historique)
// ====================================================================

// ... (Ajouter ici les routes Housing, Booking, etc.) ...

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


// GET /api/conversations/:id/messages : Récupérer les messages d'une conversation (HISTORIQUE)
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }
        
        // 🔑 CLÉ : Cette requête doit trouver les messages si le WebSocket les a enregistrés
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name') 
            .sort({ createdAt: 1 });
            
        // 🔍 LOG DE DÉBOGAGE : Vérifiez si ce log affiche '0' ou le bon nombre
        console.log(`Historique récupéré pour la conversation ${id} : ${messages.length} messages.`);
            
        res.status(200).json({ messages }); 
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});


// ====================================================================
// 5. GESTION DES WEBSOCKETS (Logique corrigée/débuggée)
// ====================================================================

const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null; 
    
    // ... (Logique de vérification de token et d'affectation de userId à partir du req.url) ...

    if (userId) {
        userWsMap.set(userId.toString(), ws);
    }
    
    ws.on('message', async (message) => {
        if (!userId) return;
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;

                // Enregistrement du message en base de données
                const newMessage = new Message({ conversation: conversationId, sender: userId, content: content });
                
                // 🔍 LOG DE DÉBOGAGE 1 : Affiche l'objet Mongoose avant la sauvegarde
                console.log("Tentative d'enregistrement de message:", { 
                    conversationId: newMessage.conversation.toString(), 
                    sender: newMessage.sender.toString(), 
                    content: newMessage.content.substring(0, 30) 
                });
                
                await newMessage.save(); // 🔑 L'ÉCHEC SILENCIEUX est ici !
                
                // 🔍 LOG DE DÉBOGAGE 2 : Confirme la réussite de la sauvegarde
                console.log("Message enregistré avec succès. ID:", newMessage._id);

                // Mise à jour de la conversation (lastMessage et updatedAt)
                await Conversation.findByIdAndUpdate(conversationId, { lastMessage: newMessage._id, updatedAt: Date.now() });

                // Création de l'objet message à renvoyer aux clients
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    payload: { 
                        _id: newMessage._id, 
                        content: newMessage.content, 
                        sender: { _id: userId.toString() }, // On s'assure que c'est une string
                        createdAt: newMessage.createdAt, 
                        conversation: conversationId,
                    }
                };
                
                // Envoyer au destinataire
                const recipientWs = userWsMap.get(recipientId.toString());
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messageToSend));
                }

                // Envoyer à l'expéditeur (pour l'afficher immédiatement)
                ws.send(JSON.stringify(messageToSend)); 
            }

        } catch (error) {
            // 🚨 LOG DE DÉBOGAGE 3 : C'est ici que vous verrez pourquoi la sauvegarde a échoué !
            console.error('🚨 ERREUR CRITIQUE DE SAUVEGARDE (WebSocket):', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur lors de la sauvegarde.' }));
        }
    });

    // ... (Logique de déconnexion) ...
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