// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// Importe les modules nécessaires
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

// Crée une instance de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware CORS
app.use(cors());

// Middleware pour analyser les requêtes JSON
app.use(express.json());

// Middleware pour la vérification du token JWT
app.use(authMiddleware);

// Route pour démarrer une conversation
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { recipientId, housingId } = req.body; // Récupère le housingId du corps de la requête
        const senderId = req.userData.userId;

        // Recherche une conversation existante entre ces deux participants et ce logement
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
            housing: housingId
        });

        if (!conversation) {
            // Créer une nouvelle conversation si elle n'existe pas
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId // Assigner le housingId
            });
            await conversation.save();
        }

        res.status(200).json({ conversationId: conversation._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du démarrage de la conversation.' });
    }
});

// Route pour obtenir la liste des conversations de l'utilisateur
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const conversations = await Conversation.find({ participants: userId }).populate('participants', 'name');
        res.status(200).json({ conversations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des conversations.' });
    }
});

// Route pour obtenir les messages d'une conversation spécifique
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
        }
        const messages = await Message.find({ conversation: id }).populate('sender', 'name');
        res.status(200).json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des messages.' });
    }
});

// Route pour envoyer un message
app.post('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const senderId = req.userData.userId;

        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.includes(senderId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne pouvez pas envoyer de message à cette conversation.' });
        }

        const newMessage = new Message({
            conversation: id,
            sender: senderId,
            content,
        });

        await newMessage.save();
        res.status(201).json({ message: 'Message envoyé avec succès !', newMessage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'envoi du message.' });
    }
});

// Route pour la documentation de l'API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Définition de la route de test
app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

// Le serveur démarre et écoute sur le port défini
app.listen(PORT, () => {
    console.log(`Le serveur est démarré sur le port ${PORT}`);
});
