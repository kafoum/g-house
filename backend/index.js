// Fichier : backend/index.js

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// Importe les modules nécessaires
const authMiddleware = require('./middleware/auth'); // Votre middleware d'authentification
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Utilisé pour hacher et comparer les mots de passe
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const path = require('path');
const cors = require('cors'); 

// Importe les modules WebSocket
const http = require('http');
const WebSocket = require('ws');

// INITIALISATION DE STRIPE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

// Configurez Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurez Multer pour la gestion des fichiers en mémoire
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importe les modèles
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

// Connexion à la base de données MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(err => console.error('Erreur de connexion à MongoDB :', err));


// ====================================================================
// MIDDLEWARES GLOBALES
// ====================================================================

app.use(cors());
app.use(express.json()); // pour parser les requêtes JSON (application/json)
// Middleware pour gérer les données de formulaires HTML non-JSON
app.use(express.urlencoded({ extended: true }));


// ====================================================================
// 🔑 ROUTES D'AUTHENTIFICATION (Ajoutées pour résoudre le problème 400)
// ====================================================================

// 1. Route d'inscription : POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Création d'un nouvel utilisateur (le middleware 'pre' dans User.js hache le mot de passe)
        const user = await User.create({ name, email, password, role });

        // Succès de l'inscription
        res.status(201).json({ 
            message: 'Inscription réussie ! Veuillez vous connecter.', 
            user: { _id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        // Gérer les erreurs de validation ou de duplicata (email unique)
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
        }
        console.error("Erreur lors de l'inscription :", error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
    }
});


// 2. Route de connexion : POST /api/login (Le point critique à vérifier)
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Trouver l'utilisateur par email
        const user = await User.findOne({ email });

        // Si l'utilisateur n'existe pas, renvoyer 400 (Bad Request)
        if (!user) {
            // Renvoyer un message générique pour ne pas révéler si l'email existe ou non.
            return res.status(400).json({ message: 'Identifiants invalides.' }); 
        }

        // 2. 🔑 COMPARER LE MOT DE PASSE HACHÉ (Utilise bcrypt.compare)
        const isMatch = await bcrypt.compare(password, user.password);

        // Si la comparaison échoue, renvoyer 400 (Bad Request)
        if (!isMatch) {
            return res.status(400).json({ message: 'Identifiants invalides.' }); 
        }
        
        // 3. Générer le jeton JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role }, // Payload minimal du jeton
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 4. Succès de la connexion : renvoyer le jeton et les infos utilisateur
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
// 🔑 ROUTES DE LOGEMENT (Exemple, vos autres routes API viendraient ici)
// ====================================================================
// app.use('/api/housing', require('./routes/housing')); 
// app.use('/api/bookings', require('./routes/bookings')); 
// ... et toutes les autres routes ...


// ====================================================================
// GESTION DES WEBSOCKETS (Déjà présent dans votre snippet)
// ====================================================================

// Map pour associer userId et l'instance WebSocket
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null;

    // 1. Extraction du token du header de la requête
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const token = urlParams.get('token');

    if (token) {
        try {
            // Vérification et décodage du token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
            userWsMap.set(userId, ws); // Associer l'ID de l'utilisateur à sa connexion WS
            console.log(`Nouvel utilisateur connecté via WebSocket: ${userId}`);

            // Envoi d'une confirmation de connexion (optionnel)
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

                // 🚨 IMPORTANT : La logique d'enregistrement du message doit être ici
                // Enregistrer le message dans la base de données
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId, // L'ID de l'utilisateur connecté
                    content: content
                });
                await newMessage.save();

                // Préparer le message à envoyer aux clients
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    message: {
                        _id: newMessage._id,
                        content: newMessage.content,
                        sender: { _id: userId, name: userWsMap.get(userId)?.name || 'Moi' }, // Le nom peut être récupéré via la Map ou l'ID si nécessaire
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

    // 4. Déconnexion
    ws.on('close', () => {
        userWsMap.delete(userId); // Supprimer l'utilisateur de la map
        console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
    });
});


// ----------------------------------------------------
// FIN DES ROUTES API
// ----------------------------------------------------

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