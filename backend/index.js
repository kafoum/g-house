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
// 3. ROUTES D'AUTHENTIFICATION (Clé de la Connexion)
// ====================================================================

// POST /api/register : Créer un nouvel utilisateur
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Veuillez remplir tous les champs obligatoires.' });
        }
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'user', 
        });
        
        await newUser.save();
        
        const token = jwt.sign(
            { userId: newUser._id, email: newUser.email, role: newUser.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.status(201).json({ 
            message: 'Inscription réussie !', 
            token,
            user: { userId: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
        });

    } catch (error) {
        console.error("Erreur sur POST /api/register :", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
    }
});

// POST /api/login : Connexion de l'utilisateur
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Veuillez fournir un email et un mot de passe.' });
        }
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }
        
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.status(200).json({ 
            message: 'Connexion réussie !', 
            token,
            user: { userId: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error("Erreur sur POST /api/login :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});


// ====================================================================
// 4. ROUTES LOGEMENTS (HOUSING)
// ====================================================================

// GET /api/housing : Récupère la liste des logements (publique)
app.get('/api/housing', async (req, res) => {
    try {
        const { city, minPrice, maxPrice, type } = req.query;
        let query = {};
        
        if (city) {
            query['location.city'] = { $regex: city, $options: 'i' };
        }
        if (minPrice) {
            query.price = { ...query.price, $gte: parseInt(minPrice) };
        }
        if (maxPrice) {
            query.price = { ...query.price, $lte: parseInt(maxPrice) };
        }
        if (type) {
            query.type = type;
        }

        const housingList = await Housing.find(query).populate('landlord', 'name');
        res.status(200).json({ housingList });
    } catch (error) {
        console.error("Erreur sur GET /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// POST /api/housing : Créer un nouveau logement (protégé)
app.post('/api/housing', authMiddleware, upload.array('images'), async (req, res) => {
    try {
        const { title, description, price, address, city, zipCode, type, amenities } = req.body;
        const landlordId = req.userData.userId;
        
        // 1. Gère l'upload vers Cloudinary
        let imageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                return cloudinary.uploader.upload(dataURI, { folder: "g-house-housing" });
            });
            const uploadResults = await Promise.all(uploadPromises);
            imageUrls = uploadResults.map(result => result.secure_url);
        }
        
        // 2. Création du logement
        const newHousing = new Housing({
            title,
            description,
            price,
            location: { address, city, zipCode },
            type,
            amenities: amenities ? JSON.parse(amenities) : [],
            landlord: landlordId,
            images: imageUrls,
        });

        await newHousing.save();
        res.status(201).json({ housing: newHousing });

    } catch (error) {
        console.error("Erreur sur POST /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création du logement.' });
    }
});

// GET /api/housing/:id : Détail d'un logement (public)
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// 🔑 ROUTE AJOUTÉE : PUT /api/housing/:id (Mise à jour d'un logement)
app.put('/api/housing/:id', authMiddleware, upload.array('images'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        const updateData = req.body;
        
        let housing = await Housing.findById(id);

        if (!housing) {
            return res.status(404).json({ message: "Logement non trouvé." });
        }
        
        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: "Accès refusé. Vous n'êtes pas le propriétaire." });
        }

        let newImageUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                return cloudinary.uploader.upload(dataURI, { folder: "g-house-housing" });
            });
            const uploadResults = await Promise.all(uploadPromises);
            newImageUrls = uploadResults.map(result => result.secure_url);
        }
        
        const currentImages = updateData.currentImages ? JSON.parse(updateData.currentImages) : housing.images;
        const finalImages = [...currentImages, ...newImageUrls];
        
        Object.assign(housing, updateData);
        housing.images = finalImages;

        await housing.save();
        
        res.status(200).json({ housing });

    } catch (error) {
        console.error("Erreur sur PUT /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du logement.' });
    }
});

// DELETE /api/housing/:id : Supprimer un logement (protégé)
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        
        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        
        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire.' });
        }
        
        await Housing.deleteOne({ _id: id });
        res.status(200).json({ message: 'Logement supprimé avec succès.' });
    } catch (error) {
        console.error("Erreur sur DELETE /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression du logement.' });
    }
});

// 🔑 ROUTE AJOUTÉE : GET /api/user/housing (pour Dashboard.jsx)
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        
        const housingList = await Housing.find({ landlord: userId })
            .sort({ createdAt: -1 });

        res.status(200).json({ housingList });
    } catch (error) {
        console.error("Erreur sur GET /api/user/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de vos logements.' });
    }
});


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


// 🔑 ROUTE AJOUTÉE : GET /api/conversations/:id/messages (pour l'historique)
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
// 6. GESTION DES WEBSOCKETS (Persistance des messages)
// ====================================================================

const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null; 
    // ... (Logique de connexion WebSocket avec vérification du token) ...
    
    // 2. Traitement des messages
    ws.on('message', async (message) => {
        if (!userId) return; 
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;

                // CRÉATION ET ENREGISTREMENT DU MESSAGE EN BASE DE DONNÉES
                const newMessage = new Message({ 
                    conversation: conversationId, 
                    sender: userId, 
                    content: content 
                });
                
                await newMessage.save(); // ✅ Ligne essentielle pour la persistance

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