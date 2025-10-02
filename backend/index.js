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
// Importez les autres modèles si vous les utilisez (ex: ProfileDoc, Notification)

// Initialisation de l'application Express et du serveur HTTP pour WebSocket
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Définition du port
const PORT = process.env.PORT || 10000;


// ====================================================================
// 2. MIDDLEWARE GÉNÉRAUX ET CONNEXION DB
// ====================================================================

// Connexion à la base de données MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB établie avec succès'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err)); 

// Middleware CORS (CLÉ DE CORRECTION DES PROBLÈMES DE CONNEXION)
const allowedOrigins = [
    'https://g-house.vercel.app', 
    'http://localhost:5173',       
    'http://localhost:3000',
];

// Ajoute l'URL du FRONTEND (déployé) à la liste si elle est dans .env
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
// 3. ROUTES D'AUTHENTIFICATION
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
        res.status(201).json({ 
            message: 'Inscription réussie. Vous pouvez maintenant vous connecter.',
            user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
        });
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

// ✅ CORRECTION DU 404 : GET /api/housing/:id - Récupérer les détails d'une annonce spécifique
app.get('/api/housing/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const housing = await Housing.findById(id).populate('landlord', 'name email');

        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }

        res.status(200).json({ housing });
    } catch (error) {
        if (error.kind === 'ObjectId') {
             return res.status(404).json({ message: 'Format d\'ID d\'annonce non valide.' });
        }
        console.error("Erreur sur GET /api/housing/:id:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des détails de l\'annonce.' });
    }
});

// POST /api/user/housing : Créer une nouvelle annonce (Protégée)
// Utilise 'upload.array('images', 5)' si vous autorisez 5 images
app.post('/api/user/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent créer des annonces.' });
        }
        
        const { title, description, price, address, city, zipCode, type, amenities } = req.body;
        
        const uploadedImageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI);
                uploadedImageUrls.push(result.secure_url);
            }
        }
        
        const newHousing = new Housing({
            landlord: req.userData.userId,
            title,
            description,
            price: Number(price),
            location: { address, city, zipCode },
            type,
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            images: uploadedImageUrls,
        });

        await newHousing.save();
        res.status(201).json({ message: 'Annonce créée avec succès.', housing: newHousing });

    } catch (error) {
        console.error("Erreur sur POST /api/user/housing:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de l\'annonce.' });
    }
});

// GET /api/user/housing : Récupérer les annonces du propriétaire connecté (Protégée)
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent voir leurs annonces.' });
        }
        
        const userHousing = await Housing.find({ landlord: req.userData.userId })
            .sort({ createdAt: -1 });

        res.status(200).json({ housing: userHousing });
    } catch (error) {
        console.error("Erreur sur GET /api/user/housing:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de vos annonces.' });
    }
});

// ... (Ajoutez les autres routes PUT/DELETE /api/user/housing/:id) ...


// ====================================================================
// 5. ROUTES PAIEMENT (STRIPE)
// ====================================================================

// POST /api/bookings/create-checkout-session : Crée une session de paiement Stripe
app.post('/api/bookings/create-checkout-session', authMiddleware, async (req, res) => {
    try {
        const { housingId, startDate, endDate, totalPrice } = req.body;
        const tenantId = req.userData.userId;

        if (!housingId || !startDate || !endDate || !totalPrice || totalPrice <= 0 || !process.env.FRONTEND_URL) {
            return res.status(400).json({ message: 'Données de réservation invalides ou FRONTEND_URL manquant.' });
        }

        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }

        const newBooking = new Booking({
            housing: housingId,
            tenant: tenantId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalPrice: totalPrice,
            status: 'pending_payment' // Statut temporaire avant paiement
        });
        await newBooking.save();

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur', 
                    product_data: { name: `Réservation : ${housing.title}`, },
                    unit_amount: Math.round(totalPrice * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
            cancel_url: `${process.env.FRONTEND_URL}/housing/${housingId}?cancelled=true`,
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: tenantId.toString(),
            },
        });

        res.status(200).json({ url: session.url, sessionId: session.id, bookingId: newBooking._id });

    } catch (error) {
        console.error("Erreur Stripe lors de la création de session:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de la session de paiement.' });
    }
});

// ... (Ajoutez les autres routes de Booking si nécessaire) ...

// ====================================================================
// 6. ROUTES MESSAGERIE (Conversations & Messages)
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

        if (!housingId || !recipientId) {
            return res.status(400).json({ message: 'Les IDs de logement et de destinataire sont requis.' });
        }

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


// GET /api/conversations/:id/messages : Récupérer les messages d'une conversation
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
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
// 7. GESTION DES WEBSOCKETS
// ====================================================================

const userWsMap = new Map(); 
wss.on('connection', (ws, req) => {
    let userId = null; 
    
    // 1. Extraction et vérification du token depuis l'URL (ou l'en-tête, mais URL est commun pour les clients WS)
    const tokenMatch = req.url.match(/token=([^&]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (token) {
        try {
            const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
            userId = decodedToken.userId; 
            userWsMap.set(userId, ws);
            ws.send(JSON.stringify({ type: 'STATUS', message: 'Connexion WebSocket établie.', userId }));
        } catch (error) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Token invalide ou expiré.' }));
            ws.close(1008, 'Policy Violation: Invalid token');
            return;
        }
    } else {
        ws.close(1008, 'Policy Violation: Missing token');
        return;
    }

    // 2. Traitement des messages entrants
    ws.on('message', async (message) => {
        if (!userId) return;
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;

                // Enregistrement du message en base de données
                const newMessage = new Message({ conversation: conversationId, sender: userId, content: content });
                await newMessage.save();

                // Mise à jour de la conversation (lastMessage et updatedAt)
                await Conversation.findByIdAndUpdate(conversationId, { lastMessage: newMessage._id, updatedAt: Date.now() });

                // Création de l'objet message à renvoyer aux clients
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    payload: { 
                        _id: newMessage._id, 
                        content: newMessage.content, 
                        sender: { _id: userId }, // Utiliser l'ID pour que le client le mappe
                        createdAt: newMessage.createdAt, 
                        conversation: conversationId,
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

    // 3. Déconnexion
    ws.on('close', () => {
        if (userId) {
            userWsMap.delete(userId); 
            console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
        }
    });
});


// ====================================================================
// ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    // Message de vérification simple pour l'état du serveur
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});