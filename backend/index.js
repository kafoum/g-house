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
const swaggerSpec = require('./swagger'); // Assurez-vous d'avoir ce fichier
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
// IMPORTS DES MODÈLES MONGOOSE (Assurez-vous que ces fichiers existent)
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

// 🔑 CORRECTION : Utilisation de MONGODB_URI et retrait des options dépréciées
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(err => console.error('Erreur de connexion à MongoDB :', err));


// ====================================================================
// MIDDLEWARES GLOBALES
// ====================================================================

app.use(cors());
app.use(express.json()); // pour parser les requêtes JSON
app.use(express.urlencoded({ extended: true }));


// ====================================================================
// ROUTES D'AUTHENTIFICATION (Corrigées)
// ====================================================================

// 1. Route d'inscription : POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Le middleware 'pre' dans User.js hache le mot de passe
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


// 2. Route de connexion : POST /api/login (CORRECTION DE LA CASTERROR)
app.post('/api/login', async (req, res) => {
    try {
        // 🔑 CORRECTION : Renommer les variables pour éviter l'ambiguïté Mongoose
        const { email: userEmail, password: userPassword } = req.body;

        // 1. Trouver l'utilisateur par email
        const user = await User.findOne({ email: userEmail }); 

        if (!user) {
            return res.status(400).json({ message: 'Identifiants invalides.' }); 
        }

        // 2. Comparer le mot de passe haché
        const isMatch = await bcrypt.compare(userPassword, user.password); 

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
        console.error("Erreur lors de la connexion :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// AUTRES ROUTES API (Ajoutez vos routes ici ou utilisez des routeurs)
// ====================================================================

// Exemple de route protégée (vous utiliserez sans doute 'app.use')
// app.use('/api/housing', require('./routes/housing')); 
// app.use('/api/bookings', require('./routes/booking')); 
// app.use('/api/user', require('./routes/user')); 
// ... etc.


// ====================================================================
// GESTION DES WEBSOCKETS
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
                        sender: { _id: userId, name: 'Moi' }, // Le nom peut être récupéré de l'utilisateur ou la conversation
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
        userWsMap.delete(userId); // Supprimer l'utilisateur de la map
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