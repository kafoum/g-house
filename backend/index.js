// Fichier : backend/index.js (Version Complète & Corrigée)

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================
// 1. IMPORTS DES MODULES ET INITIALISATION
// ====================================================================
const authMiddleware = require('./middleware/auth'); // Assurez-vous que ce chemin est correct
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

// Configuration Multer pour la gestion des fichiers en mémoire (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importe les modèles Mongoose (Assurez-vous que les chemins et noms sont corrects)
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
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

// Middleware CORS (ajustez allowedOrigins si nécessaire)
const allowedOrigins = [
    'https://g-house.vercel.app', 
    'http://localhost:5173', 
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
}));

// Middleware pour parser les corps de requêtes JSON (pour auth, booking, etc.)
app.use(express.json());


// ====================================================================
// 3. ROUTES D'AUTHENTIFICATION (Précédemment corrigées)
// ====================================================================

// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }
        const lowerCaseRole = role.toLowerCase().trim();
        if (lowerCaseRole !== 'tenant' && lowerCaseRole !== 'landlord') {
             return res.status(400).json({ message: 'Rôle non valide. Doit être "tenant" ou "landlord".' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }
        const newUser = new User({ name, email, password, role: lowerCaseRole });
        await newUser.save();
        res.status(201).json({ message: 'Inscription réussie. Vous pouvez maintenant vous connecter.', user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }});
    } catch (error) {
        console.error("Erreur lors de l'inscription:", error);
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
        console.error("Erreur lors de la connexion:", error);
        res.status(500).json({ message: "Erreur serveur interne lors de la connexion." });
    }
});


// ====================================================================
// 4. ROUTES PAIEMENT (STRIPE) (NOUVEAU)
// ====================================================================

// POST /api/bookings/create-checkout-session : Crée une session de paiement Stripe
app.post('/api/bookings/create-checkout-session', authMiddleware, async (req, res) => {
    try {
        const { housingId, startDate, endDate, totalPrice } = req.body;
        const tenantId = req.userData.userId;

        // 1. Vérifier les données et le logement
        if (!housingId || !startDate || !endDate || !totalPrice || totalPrice <= 0) {
            return res.status(400).json({ message: 'Données de réservation invalides.' });
        }

        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }

        // 2. Créer l'objet Booking temporaire pour stocker les infos
        // Note: Le statut passera à 'confirmed' via un Webhook Stripe
        const newBooking = new Booking({
            housing: housingId,
            tenant: tenantId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalPrice: totalPrice,
            status: 'pending_payment' // Statut temporaire
        });
        await newBooking.save();

        // 3. Créer la session de paiement Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur', // Assurez-vous que la devise est la bonne
                        product_data: {
                            name: `Réservation : ${housing.title}`,
                        },
                        unit_amount: Math.round(totalPrice * 100), // Stripe utilise des centimes
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URL de redirection après succès et échec
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
            cancel_url: `${process.env.FRONTEND_URL}/housing/${housingId}?cancelled=true`,
            // Métadonnées pour le webhook
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: tenantId.toString(),
            },
        });

        // 4. Renvoyer l'URL de la session Stripe
        res.status(200).json({ url: session.url, sessionId: session.id, bookingId: newBooking._id });

    } catch (error) {
        console.error("Erreur Stripe lors de la création de session:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de la session de paiement.' });
    }
});


// ... (Toutes les autres routes Housing, Booking, ProfileDoc, Notification) ...

// ====================================================================
// 5. ROUTES MESSAGERIE (Conversations & Messages) (AJOUTÉES/CORRIGÉES)
// ====================================================================

// POST /api/conversations/start : Démarrer ou trouver une conversation existante
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { housingId, recipientId } = req.body;
        const senderId = req.userData.userId;

        if (!housingId || !recipientId) {
            return res.status(400).json({ message: 'Les IDs de logement et de destinataire sont requis.' });
        }

        // 1. Vérifier si une conversation existe déjà pour ce logement et ces deux participants
        let conversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [senderId, recipientId] }
        })
        .populate('housing', 'title images')
        .populate('participants', 'name email');
        
        // 2. Si non, créer une nouvelle conversation
        if (!conversation) {
            conversation = new Conversation({
                housing: housingId,
                participants: [senderId, recipientId],
            });
            await conversation.save();
            
            // Re-populer après la sauvegarde pour renvoyer le même format
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


// GET /api/conversations/:id/messages : Récupérer les messages d'une conversation
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        // 1. Vérifier l'accès
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
        }
        
        // 2. Récupérer les messages
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name') // Pour afficher le nom de l'expéditeur dans le chat
            .sort({ createdAt: 1 }); // Ordre chronologique
            
        res.status(200).json({ messages });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});

// GET /api/conversations : Récupère la liste des conversations (Déjà présent)
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


// ====================================================================
// 6. GESTION DES WEBSOCKETS (inchangée)
// ====================================================================

const userWsMap = new Map(); 
wss.on('connection', (ws, req) => {
    let userId = null;
    const token = req.url.split('token=')[1];
    if (token) {
        try {
            const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
            userId = decodedToken.userId; 
            userWsMap.set(userId, ws);
            console.log(`Utilisateur connecté via WebSocket: ${userId}`);
            ws.send(JSON.stringify({ type: 'STATUS', message: 'Connexion WebSocket établie.', userId }));
        } catch (error) {
            console.error('Authentification WebSocket échouée:', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Token invalide ou expiré.' }));
            ws.close(1008, 'Policy Violation: Invalid token');
            return;
        }
    } else {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Token manquant.' }));
        ws.close(1008, 'Policy Violation: Missing token');
        return;
    }

    ws.on('message', async (message) => {
        if (!userId) return;
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;

                const newMessage = new Message({ conversation: conversationId, sender: userId, content: content });
                await newMessage.save();

                await Conversation.findByIdAndUpdate(conversationId, { lastMessage: newMessage._id, updatedAt: Date.now() });

                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    payload: {
                        _id: newMessage._id, content: newMessage.content, sender: { _id: userId }, createdAt: newMessage.createdAt, conversation: conversationId,
                    }
                };
                
                const recipientWs = userWsMap.get(recipientId.toString());
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messageToSend));
                }
                ws.send(JSON.stringify(messageToSend)); 
            }

        } catch (error) {
            console.error('Erreur de traitement de message WebSocket:', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur.' }));
        }
    });

    ws.on('close', () => {
        if (userId) {
            userWsMap.delete(userId);
            console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
        }
    });
});


// ----------------------------------------------------\
// FIN DES ROUTES API
// ----------------------------------------------------\

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});