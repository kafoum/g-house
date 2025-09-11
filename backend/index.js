const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./middleware/auth');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const path = require('path');
const cors = require('cors');

const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

const app = express();
const PORT = process.env.PORT || 5000;

// Configurez Multer pour la gestion des fichiers en mémoire
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configurez Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Création du serveur HTTP
const server = http.createServer(app);

// Création du serveur WebSocket
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    ws.on('message', async message => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'message') {
                const { content, conversationId, token } = data;
                
                if (!token) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Token manquant.' }));
                    return;
                }
                
                let decodedToken;
                try {
                    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Token invalide.' }));
                    return;
                }

                const senderId = decodedToken.userId;

                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.includes(senderId)) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Accès refusé. Vous ne pouvez pas envoyer de message à cette conversation.' }));
                    return;
                }

                const newMessage = new Message({
                    conversation: conversationId,
                    sender: senderId,
                    content
                });

                await newMessage.save();

                // On popule le champ sender pour avoir les informations de l'utilisateur
                const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'name');

                // Diffusion du message à tous les clients connectés qui participent à cette conversation
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client.conversationId === conversationId) {
                        client.send(JSON.stringify({ type: 'message', message: populatedMessage }));
                    }
                });

            } else if (data.type === 'auth' && data.token) {
                try {
                    const decodedToken = jwt.verify(data.token, process.env.JWT_SECRET);
                    ws.userId = decodedToken.userId;
                    // On peut stocker l'ID de la conversation pour le routage des messages
                    // Le client doit envoyer l'ID de la conversation après l'authentification
                    // ws.conversationId = data.conversationId;
                } catch (err) {
                    console.error('Échec de l\'authentification WebSocket', err);
                    ws.close();
                }
            }
        } catch (error) {
            console.error('Erreur lors du traitement du message WebSocket:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client WebSocket déconnecté.');
    });

    ws.on('error', error => {
        console.error('Erreur WebSocket:', error);
    });
});

// Routes de l'API
const userRoutes = require('./routes/users');
const housingRoutes = require('./routes/housings');
const conversationRoutes = require('./routes/conversations');
const profileRoutes = require('./routes/profileDoc');

app.use('/api/users', userRoutes);
app.use('/api/housings', housingRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/profile-docs', profileRoutes);

app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { participantId, housingId } = req.body;
        const userId = req.userData.userId;

        if (userId === participantId) {
            return res.status(400).json({ message: 'Vous ne pouvez pas démarrer une conversation avec vous-même.' });
        }

        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }

        // Vérifiez s'il existe déjà une conversation
        const existingConversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [userId, participantId] }
        });

        if (existingConversation) {
            return res.status(200).json({ message: 'Conversation existante.', conversationId: existingConversation._id });
        }

        const newConversation = new Conversation({
            participants: [userId, participantId],
            housing: housingId,
        });

        await newConversation.save();
        res.status(201).json({ message: 'Conversation créée.', conversationId: newConversation._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors du démarrage de la conversation.' });
    }
});

app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;

        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }

        const messages = await Message.find({ conversation: id }).sort({ timestamp: 1 }).populate('sender', 'name');
        res.status(200).json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des messages.' });
    }
});

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

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House !');
});

const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connexion à la base de données établie avec succès.');

        server.listen(PORT, () => {
            console.log(`Serveur en écoute sur le port ${PORT}`);
        });

    } catch (err) {
        console.error('Échec de la connexion à la base de données.', err);
        process.exit(1);
    }
};

startServer();
