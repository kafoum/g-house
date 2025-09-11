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

// Connecte à MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connexion à MongoDB réussie'))
    .catch(err => console.error('Erreur de connexion à MongoDB', err));

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

// Middleware CORS et JSON
app.use(cors());
app.use(express.json());

// Définition de la route de test
app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

// --- Routes d'authentification et publiques ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, role });
        await user.save();
        res.status(201).json({ message: 'Utilisateur enregistré avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement de l\'utilisateur.', error });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mot de passe incorrect.' });
        }
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ message: 'Connexion réussie', token });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la connexion.', error });
    }
});

// Route pour l'upload d'image (accessible sans auth pour le moment)
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier n\'a été téléchargé.' });
        }
        const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`);
        res.status(200).json({ imageUrl: result.secure_url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du téléchargement de l\'image.' });
    }
});

// --- Middleware d'authentification pour les routes sécurisées ---
app.use(authMiddleware);

// --- Routes sécurisées (nécessitant un token JWT) ---
app.get('/api/user', async (req, res) => {
    try {
        const user = await User.findById(req.userData.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la récupération des données utilisateur.' });
    }
});

app.post('/api/housing', async (req, res) => {
    try {
        const housing = new Housing({ ...req.body, landlord: req.userData.userId });
        await housing.save();
        res.status(201).json({ message: 'Annonce créée avec succès', housing });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la création de l\'annonce.' });
    }
});

app.post('/api/documents', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun document n\'a été téléchargé.' });
        }
        const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
            resource_type: "auto",
        });
        const newDoc = new ProfileDoc({
            owner: req.userData.userId,
            docUrl: result.secure_url,
            docName: req.file.originalname,
            docType: req.file.mimetype,
            uploadDate: new Date()
        });
        await newDoc.save();
        res.status(201).json({ message: 'Document téléchargé avec succès.', doc: newDoc });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du téléchargement du document.' });
    }
});

app.post('/api/conversations/start', async (req, res) => {
    try {
        const { recipientId, housingId } = req.body;
        const senderId = req.userData.userId;
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
            housing: housingId
        });
        if (!conversation) {
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId
            });
            await conversation.save();
        }
        res.status(200).json({ conversationId: conversation._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors du démarrage de la conversation.' });
    }
});

app.get('/api/conversations', async (req, res) => {
    try {
        const userId = req.userData.userId;
        const conversations = await Conversation.find({ participants: userId }).populate('participants', 'name');
        res.status(200).json({ conversations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des conversations.' });
    }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
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

app.post('/api/conversations/:id/messages', async (req, res) => {
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

// Le serveur démarre et écoute sur le port défini
app.listen(PORT, () => {
    console.log(`Le serveur est démarré sur le port ${PORT}`);
});
