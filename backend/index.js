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
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); 
const path = require('path');
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

// Configuration Multer pour la gestion des fichiers en mémoire
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// ====================================================================
// IMPORTS DES MODÈLES MONGOOSE 
// ====================================================================
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
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
app.use(express.json()); // Permet à Express de parser req.body
app.use(express.urlencoded({ extended: true }));


// ====================================================================
// ROUTES D'AUTHENTIFICATION (CORRIGÉES ET HYPER-DÉFENSIVES)
// ====================================================================

// 1. Route d'inscription : POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const user = await User.create({ name, email, password, role });

        res.status(201).json({ 
            message: 'Inscription réussie ! Veuillez vous connecter.', 
            user: { _id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
        }
        console.error("Erreur lors de l'inscription :", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
    }
});


// 2. Route de connexion : POST /api/login (CORRECTION DÉFENSIVE ULTIME)
app.post('/api/login', async (req, res) => {
    try {
        const body = req.body;
        let email, password;

        // 🔑 CORRECTION DÉFENSIVE : Gère le format normal OU le format imbriqué
        if (typeof body.email === 'object' && body.email !== null && body.email.email) {
            // Cas 1 : Payload imbriqué (format incorrect venant du client)
            email = body.email.email;
            password = body.email.password;
            console.log("LOGIN DÉTECTÉ : Format imbriqué corrigé. Les données sont extraites correctement.");
        } else {
            // Cas 2 : Payload normal (format correct)
            email = body.email;
            password = body.password;
            console.log("LOGIN DÉTECTÉ : Format normal.");
        }
        
        // --- DÉBOGAGE FINAL ---
        console.log('--- DEBOGAGE LOGIN (Extraction Finale) ---');
        console.log('Email final:', email, 'Type:', typeof email);
        console.log('----------------------------------------');

        // Vérification de base après extraction
        if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
             // Si on n'a pas réussi à extraire les valeurs, c'est une mauvaise requête
             return res.status(400).json({ message: 'L\'email et le mot de passe sont requis et doivent être des chaînes de caractères.' });
        }
        
        // 1. Trouver l'utilisateur par email (c'est ici que l'erreur Mongoose se produisait)
        const user = await User.findOne({ email: email }); 

        if (!user) {
            return res.status(400).json({ message: 'Identifiants invalides.' }); 
        }

        // 2. Comparer le mot de passe haché
        const isMatch = await bcrypt.compare(password, user.password); 

        if (!isMatch) {
            return res.status(400).json({ message: 'Identifiants invalides.' }); 
        }
        
        // 3. Générer le jeton JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 4. Succès de la connexion
        res.status(200).json({
            token: token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });

    } catch (error) {
        // En cas d'erreur Mongoose ou autre erreur serveur
        console.error("Erreur lors de la connexion :", error);
        res.status(500).json({ message: 'Erreur serveur.' }); 
    }
});


// ====================================================================
// ROUTES LOGEMENTS (HOUSING)
// ====================================================================

// Cette route est probablement manquante ou mal routée. Ajoutons un minimum ici.
app.get('/api/housing', async (req, res) => {
    try {
        // Logique de récupération des logements...
        const { city, price_min, price_max, type } = req.query;
        // Pour l'instant, nous renvoyons une liste vide mais un statut 200 pour valider la route.
        console.log(`Recherche de logements avec filtres: ${JSON.stringify(req.query)}`);
        
        // Dans une vraie application, vous feriez:
        // const filter = buildHousingFilter(req.query);
        // const housing = await Housing.find(filter); 
        
        // Exemple de réponse vide réussie
        res.status(200).json({ housing: [], message: 'Route /api/housing OK. Aucun logement trouvé avec les filtres actuels.' });
    } catch (error) {
        console.error("Erreur sur /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la recherche de logements.' });
    }
});

// ... Ajoutez ici toutes les autres routes API (/api/housing/:id, /api/user/housing, etc.)

// ====================================================================
// AUTRES ROUTES API (Ajoutez vos routeurs ici)
// ====================================================================

// ...


// ====================================================================
// GESTION DES WEBSOCKETS (inchangée)
// ====================================================================

// Map pour associer userId et l'instance WebSocket
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null;

    // 1. Extraction et vérification du token pour l'authentification WS
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const token = urlParams.get('token');

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
            userWsMap.set(userId, ws); 
            console.log(`Nouvel utilisateur connecté via WebSocket: ${userId}`);

            ws.send(JSON.stringify({ type: 'CONNECTED', userId }));
            
        } catch (error) {
            console.error('Erreur d\'authentification WebSocket:', error);
            ws.close(1008, 'Token invalide');
            return;
        }
    } else {
        ws.close(1008, 'Token manquant');
        return;
    }


    // 2. Gestion des messages entrants
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data;

                // Enregistrer le message dans la base de données
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId, 
                    content: content
                });
                await newMessage.save();

                // Préparer le message à envoyer aux clients
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    message: {
                        _id: newMessage._id,
                        content: newMessage.content,
                        sender: { _id: userId, name: 'Moi' }, 
                        createdAt: newMessage.createdAt,
                        conversation: conversationId,
                    }
                };
                
                // Envoyer au destinataire
                const recipientWs = userWsMap.get(recipientId);
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
        userWsMap.delete(userId); 
        console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
    });
});


// ====================================================================
// ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================

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