// Fichier : backend/index.js

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================
// IMPORTS DES MODULES
// ====================================================================
const authMiddleware = require('./middleware/auth'); 
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

// ====================================================================
// INITIALISATION DES SERVICES EXTERNES
// ====================================================================

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


// ====================================================================
// IMPORTS DES MODÈLES MONGOOSE 
// ====================================================================
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// Initialisation de l'application Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 5000;

// ====================================================================
// CONNEXION À LA BASE DE DONNÉES
// ====================================================================

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(err => console.error('Erreur de connexion à MongoDB :', err));


// ====================================================================
// MIDDLEWARES GLOBALES
// ====================================================================

app.use(cors());
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));


// ====================================================================
// 3. ROUTES D'AUTHENTIFICATION (INCHANGÉES / CORRIGÉES DÉFENSIVEMENT)
// ====================================================================

// 1. Route d'inscription : POST /api/register (à compléter)
app.post('/api/register', async (req, res) => {
    // ... (Logique d'inscription ici)
});

// 2. Route de connexion : POST /api/login (CORRIGÉE DÉFENSIVEMENT)
app.post('/api/login', async (req, res) => {
    try {
        const body = req.body;
        let email, password;

        // CORRECTION DÉFENSIVE : Gère le format normal OU le format imbriqué
        if (typeof body.email === 'object' && body.email !== null && body.email.email) {
            email = body.email.email;
            password = body.email.password;
        } else {
            email = body.email;
            password = body.password;
        }
        
        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
             return res.status(400).json({ message: 'L\'email et le mot de passe sont requis.' });
        }
        
        const user = await User.findOne({ email: email }); 

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Identifiants invalides.' }); 
        }
        
        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({ token: token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });

    } catch (error) {
        console.error("Erreur lors de la connexion :", error);
        res.status(500).json({ message: 'Erreur serveur.' }); 
    }
});


// ====================================================================
// 4. ROUTES LOGEMENTS (HOUSING) - AJOUT DES ROUTES 404 PRÉCÉDENTES
// ====================================================================

// Route 4.1 : Récupérer les annonces du propriétaire : GET /api/user/housing (était 404)
// Nécessite l'authentification (authMiddleware) et un rôle 'landlord'
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: "Accès refusé. Seul le propriétaire peut accéder à cette ressource." });
        }
        
        const userId = req.userData.userId;
        const housing = await Housing.find({ landlord: userId }).populate('landlord', 'name email');

        res.status(200).json({ housing: housing });
    } catch (error) {
        console.error("Erreur sur GET /api/user/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de vos logements.' });
    }
});


// Route 4.2 : Créer un nouveau logement : POST /api/housing (était 404)
// Nécessite l'authentification et l'upload de fichiers (multer)
app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: "Accès refusé. Seul le propriétaire peut créer un logement." });
        }

        const { title, description, price, city, zipCode, type, amenities, address } = req.body;
        const landlord = req.userData.userId;
        
        // 1. Upload des images sur Cloudinary
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Simuler l'upload Cloudinary (cette partie doit être fonctionnelle chez vous)
                const result = await cloudinary.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    { folder: "g-house-housing" } 
                );
                imageUrls.push(result.secure_url);
            }
        }
        
        // 2. Création du logement
        const newHousing = new Housing({
            title,
            description,
            price,
            landlord,
            location: { address, city, zipCode },
            type,
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            images: imageUrls
        });

        await newHousing.save();

        res.status(201).json({ 
            message: 'Logement créé avec succès !', 
            housing: newHousing 
        });

    } catch (error) {
        console.error("Erreur sur POST /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création du logement.' });
    }
});

// Route 4.3 : Récupérer tous les logements (pour la HousingList) : GET /api/housing (corrigée précédemment, réintégrée ici)
app.get('/api/housing', async (req, res) => {
    try {
        // Logique de récupération des logements...
        const { city, price_min, price_max, type } = req.query;
        // ... Logique de filtre ...
        const housing = await Housing.find().populate('landlord', 'name');
        
        res.status(200).json({ housing: housing });
    } catch (error) {
        console.error("Erreur sur /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la recherche de logements.' });
    }
});

// ... Ajoutez ici les autres routes housing (GET /api/housing/:id, PUT/DELETE /api/housing/:id) ...


// ====================================================================
// 5. ROUTES MESSAGERIE (CONVERSATIONS) - AJOUT DE LA ROUTE 404 PRÉCÉDENTE
// ====================================================================

// Route 5.1 : Récupérer la liste des conversations : GET /api/conversations (était 404)
// Nécessite l'authentification (authMiddleware)
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;

        const conversations = await Conversation.find({ participants: userId })
            // Populater les participants, exclure le mot de passe, et inclure le dernier message
            .populate('participants', 'name email') 
            .populate({
                path: 'lastMessage',
                select: 'content sender createdAt' // Récupère le contenu, l'expéditeur et la date du dernier message
            })
            .sort({ updatedAt: -1 }); // Trié par la dernière activité

        res.status(200).json({ conversations });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des conversations.' });
    }
});


// ... Ajoutez ici les autres routes (POST /api/conversations/start, GET /api/conversations/:id/messages) ...


// ====================================================================
// 6. GESTION DES WEBSOCKETS (inchangée)
// ====================================================================

// Map pour associer userId et l'instance WebSocket
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    // ... (Logique WebSocket inchangée)
});


// ====================================================================
// ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});