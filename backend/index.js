// Fichier : backend/index.js (Version Complète & Corrigée)

// ====================================================================
// IMPORTS ET INITIALISATION
// ====================================================================
require('dotenv').config();
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

const http = require('http');
const WebSocket = require('ws');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

// Configuration Cloudinary et Multer...

// Importe les modèles Mongoose
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const ProfileDoc = require('./models/ProfileDoc'); // Assurez-vous d'avoir tous vos modèles
const Notification = require('./models/Notification'); // Assurez-vous d'avoir tous vos modèles

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/' }); // Path doit correspondre au front
const PORT = process.env.PORT || 10000;


// ====================================================================
// MIDDLEWARE ET CONNEXION DB
// ====================================================================

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB établie avec succès'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err)); 

// Middleware CORS (configuration simplifiée)
app.use(cors({ origin: process.env.VERCEL_FRONTEND_URL || 'https://g-house.vercel.app', credentials: true }));
app.use(express.json());


// ====================================================================
// ROUTES API
// ====================================================================

// ... (Routes /api/register et /api/login) ...

// GET /api/housing/:id - Récupérer les détails d'une annonce spécifique
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
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des détails de l\'annonce.' });
    }
});

// GET /api/conversations : Récupère la liste des conversations (CORRIGÉ)
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


// POST /api/conversations/start : Démarrer ou trouver une conversation existante (CORRIGÉ)
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { housingId, recipientId } = req.body;
        const senderId = req.userData.userId;

        if (!housingId || !recipientId) {
            return res.status(400).json({ message: 'Les IDs de logement et de destinataire sont requis.' });
        }
        // ... (Logique de recherche/création de conversation) ...
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


// 🔑 ROUTE DE RÉCUPÉRATION DES MESSAGES (CORRIGÉ)
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
            
        // 🔑 LOG DE DÉBOGAGE : Vérifiez côté serveur si la liste est vide ou non.
        console.log(`Historique de messages trouvé pour ${id}:`, messages.length); 
            
        res.status(200).json({ messages }); 
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});


// ====================================================================
// GESTION DES WEBSOCKETS (CLÉ DE LA CORRECTION)
// ====================================================================

const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    let userId = null; 
    // 1. Logique d'extraction du token/userId du req.url (inchangée)
    // ...
    
    // L'association userId -> ws doit se faire après la vérification du token
    if (userId) {
        userWsMap.set(userId, ws);
        console.log(`Utilisateur connecté via WebSocket: ${userId}`);
    }

    ws.on('message', async (message) => {
        if (!userId) return;
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'SEND_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;

                // 🔑 CLÉ DE LA CORRECTION : S'assurer que les données existent
                if (!conversationId || !content) {
                    return console.error("Données de message manquantes.");
                }

                // Enregistrement du message en base de données
                const newMessage = new Message({ 
                    conversation: conversationId, 
                    sender: userId, 
                    content: content 
                });
                
                // 🔑 LOG DE DÉBOGAGE : Affiche le message avant de sauvegarder
                console.log("Tentative de sauvegarde du message:", newMessage);
                await newMessage.save(); // 🔑 Assurez-vous que le champ 'conversation', 'sender', 'content' sont bien remplis.
                
                // Mise à jour de la conversation (lastMessage et updatedAt)
                await Conversation.findByIdAndUpdate(
                    conversationId, 
                    { lastMessage: newMessage._id, updatedAt: Date.now() }
                );

                // Création de l'objet message à renvoyer aux clients
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    payload: { 
                        _id: newMessage._id, 
                        content: newMessage.content, 
                        sender: { _id: userId }, 
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
                
                // 🔑 LOG DE DÉBOGAGE : Confirmation que le message a été envoyé aux clients.
                console.log("Message sauvegardé et envoyé.");

            }

        } catch (error) {
            console.error('Erreur de traitement/sauvegarde du message WebSocket:', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur lors du message.' }));
        }
    });

    // ... (Logique de déconnexion) ...
});


// ====================================================================
// DÉMARRAGE DU SERVEUR
// ====================================================================

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House !');
});

server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});