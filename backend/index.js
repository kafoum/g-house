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

// Importe les modules WebSocket
const http = require('http');
const WebSocket = require('ws');

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

// Crée le serveur HTTP
const server = http.createServer(app);

// Crée le serveur WebSocket en utilisant le serveur HTTP
const wss = new WebSocket.Server({ server });

// Stocke les connexions WebSocket par utilisateur
const clients = new Map();

// Gère les connexions WebSocket
wss.on('connection', ws => {
    console.log('Client WebSocket connecté.');

    ws.on('message', async message => {
        try {
            const data = JSON.parse(message);
            const { type, token, content, conversationId } = data;

            if (type === 'auth' && token) {
                // Authentifie le client WebSocket
                const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
                ws.userId = decodedToken.userId;
                clients.set(ws.userId, ws);
                console.log(`Utilisateur ${ws.userId} authentifié pour les WebSockets.`);
            } else if (type === 'message' && ws.userId && content && conversationId) {
                // Enregistre le message dans la base de données
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: ws.userId,
                    content,
                });
                await newMessage.save();

                // Trouve la conversation pour diffuser le message
                const conversation = await Conversation.findById(conversationId).populate('participants');
                if (conversation) {
                    const messageData = {
                        type: 'message',
                        conversationId: conversationId,
                        message: {
                            _id: newMessage._id,
                            content: newMessage.content,
                            sender: {
                                _id: ws.userId,
                                name: conversation.participants.find(p => p._id.toString() === ws.userId).name,
                            },
                            createdAt: newMessage.createdAt,
                        }
                    };
                    const messageString = JSON.stringify(messageData);

                    // Envoie le message à tous les participants de la conversation
                    conversation.participants.forEach(participant => {
                        const clientWs = clients.get(participant._id.toString());
                        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(messageString);
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Erreur de message WebSocket:", error);
        }
    });

    ws.on('close', () => {
        if (ws.userId) {
            clients.delete(ws.userId);
            console.log(`Utilisateur ${ws.userId} déconnecté.`);
        }
        console.log('Client WebSocket déconnecté.');
    });
});


// Middleware CORS
// Configuration spécifique pour autoriser les requêtes depuis votre domaine Vercel
const corsOptions = {
    origin: 'https://g-house.vercel.app',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));


// Middleware pour analyser les requêtes JSON
app.use(express.json());

// Configurez le transporteur d'e-mail
const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Connexion à MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(() => console.log('Connexion à MongoDB échouée !'));

// Route d'inscription
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation simple des champs
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword, role });
        await newUser.save();
        res.status(201).json({ message: 'Utilisateur inscrit avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de l\'inscription de l\'utilisateur.', error: error.message });
    }
});

// Route de connexion
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }
        const token = jwt.sign({ userId: user._id, role: user.role, userName: user.name }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, role: user.role, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la connexion.', error: error.message });
    }
});

// Route pour la création d'une nouvelle annonce
app.post('/api/housing', authMiddleware, upload.array('images'), async (req, res) => {
    try {
        const { title, description, price, location, type, amenities } = req.body;
        const landlordId = req.userData.userId; // Récupération de l'ID du token

        if (!landlordId) {
            return res.status(401).json({ message: 'ID de propriétaire manquant. Vous devez être connecté pour créer une annonce.' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "Veuillez uploader au moins une image." });
        }

        const imageUrls = [];
        for (const file of req.files) {
            const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${file.buffer.toString('base64')}`);
            imageUrls.push(result.secure_url);
        }

        const newHousing = new Housing({
            title,
            description,
            price,
            location: JSON.parse(location),
            type,
            amenities: amenities.split(',').map(a => a.trim()),
            images: imageUrls,
            landlord: landlordId
        });

        await newHousing.save();
        res.status(201).json({ message: "Annonce créée avec succès.", housing: newHousing });
    } catch (error) {
        console.error("Erreur détaillée lors de la création de l'annonce :", error);
        res.status(500).json({ message: "Erreur lors de la création de l'annonce.", error: error.message });
    }
});

// Route pour récupérer toutes les annonces
app.get('/api/housing', async (req, res) => {
    try {
        const query = {};
        if (req.query.city) {
            query['location.city'] = new RegExp(req.query.city, 'i'); // Recherche insensible à la casse
        }
        if (req.query.price_min || req.query.price_max) {
            query.price = {};
            if (req.query.price_min) {
                query.price.$gte = req.query.price_min;
            }
            if (req.query.price_max) {
                query.price.$lte = req.query.price_max;
            }
        }
        if (req.query.type) {
            query.type = req.query.type;
        }
        const allHousing = await Housing.find(query);
        res.status(200).json({ housing: allHousing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des annonces.' });
    }
});

// Route pour récupérer les annonces d'un propriétaire
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const housing = await Housing.find({ landlord: userId }).populate('landlord', 'name');
        res.status(200).json({ housing });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des annonces du propriétaire.', error: error.message });
    }
});

// Route pour récupérer une annonce par son ID
app.get('/api/housing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const housing = await Housing.findById(id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: "Annonce non trouvée." });
        }
        res.status(200).json({ housing });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération de l\'annonce.', error: error.message });
    }
});

// Route pour la modification d'une annonce
app.put('/api/housing/:id', authMiddleware, upload.array('images'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price, location, type, amenities } = req.body;
        const userId = req.userData.userId;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: "Annonce non trouvée." });
        }

        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: "Accès refusé. Vous n'êtes pas le propriétaire de cette annonce." });
        }

        let imageUrls = housing.images;
        if (req.files && req.files.length > 0) {
            const newImages = [];
            for (const file of req.files) {
                const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${file.buffer.toString('base64')}`);
                newImages.push(result.secure_url);
            }
            imageUrls = newImages;
        }

        const updatedHousing = await Housing.findByIdAndUpdate(
            id,
            {
                title,
                description,
                price,
                location: JSON.parse(location),
                type,
                amenities: amenities.split(',').map(a => a.trim()),
                images: imageUrls
            },
            { new: true, runValidators: true }
        );

        res.status(200).json({ message: "Annonce modifiée avec succès.", housing: updatedHousing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la modification de l'annonce." });
    }
});

// Route pour la suppression d'une annonce
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: "Annonce non trouvée." });
        }

        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: "Accès refusé. Vous n'êtes pas le propriétaire de cette annonce." });
        }

        await Housing.findByIdAndDelete(id);
        res.status(200).json({ message: "Annonce supprimée avec succès." });
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la suppression de l'annonce." });
    }
});


// Routes pour la messagerie
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { recipientId } = req.body;
        const senderId = req.userData.userId;
        const existingConversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] }
        });
        if (existingConversation) {
            return res.status(200).json({ conversationId: existingConversation._id });
        }
        const newConversation = new Conversation({
            participants: [senderId, recipientId]
        });
        await newConversation.save();
        res.status(201).json({ message: 'Conversation créée.', conversationId: newConversation._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors du démarrage de la conversation.' });
    }
});

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

// Route pour la documentation de l'API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Définition de la route de test
app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

// Le serveur démarre et écoute sur le port défini
server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});
