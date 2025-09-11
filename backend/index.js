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

// Importation des modules pour WebSockets
const http = require('http');
const { Server } = require('socket.io');

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
const Conversation = require('..//models/Conversation');
const Message = require('./models/Message');

// Crée une instance de l'application Express et du serveur HTTP
const app = express();
const httpServer = http.createServer(app);

// Configurez Socket.io pour la communication en temps réel
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

// Middleware CORS
app.use(cors());

// Middleware pour analyser les requêtes JSON
app.use(express.json());

// Fonction de connexion à la base de données
const connectDB = async () => {
    try {
        console.log('Tentative de connexion à la base de données...');
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connexion à la base de données établie avec succès !');
    } catch (error) {
        console.error('Erreur de connexion à la base de données :', error.message);
        console.error('Détails de l\'erreur :', error);
        // Arrête le processus en cas d'échec de connexion critique
        process.exit(1);
    }
};

// Événements de connexion Mongoose
mongoose.connection.on('connected', () => {
    console.log('Mongoose est connecté.');
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose est déconnecté.');
});

// Gère la déconnexion de l'application
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('Mongoose déconnecté via la terminaison de l\'application.');
    process.exit(0);
});

// Établir la connexion à la base de données
connectDB();

// Gère les connexions WebSocket
io.on('connection', (socket) => {
    console.log('Nouvel utilisateur connecté par WebSocket:', socket.id);

    // L'utilisateur rejoint une conversation spécifique
    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`Utilisateur ${socket.id} a rejoint la conversation ${conversationId}`);
    });

    // Gère la déconnexion d'un utilisateur
    socket.on('disconnect', () => {
        console.log('Utilisateur déconnecté:', socket.id);
    });
});

// Routes de l'API
// Nouvelle route pour vérifier le statut de la base de données
app.get('/api/status', (req, res) => {
    if (mongoose.connection.readyState === 1) {
        res.status(200).json({ status: 'connected', message: 'La base de données est connectée et fonctionne.' });
    } else {
        res.status(503).json({ status: 'disconnected', message: 'La base de données n\'est pas connectée.' });
    }
});

// Route d'enregistrement
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, role });
        await user.save();
        res.status(201).json({ message: 'Utilisateur enregistré avec succès !' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de l\'enregistrement de l\'utilisateur.', error: error.message });
    }
});

// Route de connexion
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }
        const token = jwt.sign({ userId: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la connexion.', error: error.message });
    }
});

// Routes pour les logements
// Créer un logement
app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        if (req.userData.role !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent créer des logements.' });
        }
        const { title, description, price, location, bathrooms, bedrooms, amenities, propertyType } = req.body;
        const images = [];
        for (const file of req.files) {
            const result = await cloudinary.uploader.upload(`data:image/png;base64,${file.buffer.toString('base64')}`, { folder: 'housing' });
            images.push(result.secure_url);
        }
        const housing = new Housing({
            title,
            description,
            price,
            location,
            images,
            landlord: req.userData.userId,
            amenities: amenities.split(','),
            bathrooms,
            bedrooms,
            propertyType,
        });
        await housing.save();
        res.status(201).json({ message: 'Logement créé avec succès !', housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la création du logement.', error: error.message });
    }
});

// Récupérer tous les logements
app.get('/api/housing', async (req, res) => {
    try {
        const housings = await Housing.find().populate('landlord', 'name email');
        res.status(200).json({ housings });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des logements.', error: error.message });
    }
});

// Récupérer un logement par ID
app.get('/api/housing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const housing = await Housing.findById(id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération du logement.', error: error.message });
    }
});

// Gérer les logements d'un propriétaire
app.get('/api/manage-housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const housings = await Housing.find({ landlord: userId });
        res.status(200).json({ housings });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des logements.', error: error.message });
    }
});

// Mettre à jour un logement
app.put('/api/housing/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, price, location, bathrooms, bedrooms, amenities, propertyType } = req.body;
        const housing = await Housing.findById(id);

        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        if (housing.landlord.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de ce logement.' });
        }

        const updates = { title, description, price, location, bathrooms, bedrooms, amenities: amenities.split(','), propertyType };

        if (req.files && req.files.length > 0) {
            const newImages = [];
            for (const file of req.files) {
                const result = await cloudinary.uploader.upload(`data:image/png;base64,${file.buffer.toString('base64')}`, { folder: 'housing' });
                newImages.push(result.secure_url);
            }
            updates.images = newImages;
        }

        const updatedHousing = await Housing.findByIdAndUpdate(id, updates, { new: true });
        res.status(200).json({ message: 'Logement mis à jour avec succès !', housing: updatedHousing });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour du logement.', error: error.message });
    }
});

// Supprimer un logement
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const housing = await Housing.findById(id);

        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        if (housing.landlord.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de ce logement.' });
        }

        await Housing.findByIdAndDelete(id);
        res.status(200).json({ message: 'Logement supprimé avec succès !' });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la suppression du logement.', error: error.message });
    }
});

// Routes pour les réservations (Bookings)
// Créer une réservation
app.post('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const { housingId, checkIn, checkOut } = req.body;
        const existingBooking = await Booking.findOne({
            housing: housingId,
            $or: [
                { checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }
            ]
        });

        if (existingBooking) {
            return res.status(400).json({ message: 'Ce logement est déjà réservé pour ces dates.' });
        }

        const booking = new Booking({
            housing: housingId,
            tenant: req.userData.userId,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut)
        });

        await booking.save();
        res.status(201).json({ message: 'Réservation créée avec succès !', booking });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la création de la réservation.', error: error.message });
    }
});

// Récupérer les réservations de l'utilisateur
app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const tenantId = req.userData.userId;
        const bookings = await Booking.find({ tenant: tenantId }).populate('housing');
        res.status(200).json({ bookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération de vos réservations.' });
    }
});

// Route pour l'envoi d'e-mails
app.post('/api/send-email', authMiddleware, async (req, res) => {
    try {
        const { to, subject, text } = req.body;
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'E-mail envoyé avec succès !' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'envoi de l\'e-mail.' });
    }
});

// Routes pour les documents de profil
app.post('/api/profile-docs', authMiddleware, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Veuillez télécharger un document.' });
        }
        const result = await cloudinary.uploader.upload(`data:application/pdf;base64,${req.file.buffer.toString('base64')}`, { folder: 'profile-docs', resource_type: 'raw' });
        const newDoc = new ProfileDoc({
            userId: req.userData.userId,
            documentUrl: result.secure_url,
            documentType: req.body.documentType,
        });
        await newDoc.save();
        res.status(201).json({ message: 'Document de profil téléchargé avec succès !', document: newDoc });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors du téléchargement du document.', error: error.message });
    }
});

app.get('/api/profile-docs', authMiddleware, async (req, res) => {
    try {
        const docs = await ProfileDoc.find({ userId: req.userData.userId });
        res.status(200).json({ docs });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des documents.', error: error.message });
    }
});

app.delete('/api/profile-docs/:id', authMiddleware, async (req, res) => {
    try {
        const doc = await ProfileDoc.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({ message: 'Document non trouvé.' });
        }
        if (doc.userId.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Ce document ne vous appartient pas.' });
        }
        await ProfileDoc.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Document supprimé avec succès !' });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors de la suppression du document.', error: error.message });
    }
});

// Routes de messagerie
// Démarrer une conversation
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { recipientId } = req.body;
        const senderId = req.userData.userId;
        const existingConversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] }
        });
        if (existingConversation) {
            return res.status(200).json({ conversationId: existingConversation._id, message: 'Conversation existante récupérée.' });
        }
        const newConversation = new Conversation({
            participants: [senderId, recipientId],
        });
        await newConversation.save();
        res.status(201).json({ conversationId: newConversation._id, message: 'Nouvelle conversation démarrée.' });
    } catch (error) {
        res.status(500).json({ message: 'Une erreur est survenue lors du démarrage de la conversation.', error: error.message });
    }
});

// Récupérer les conversations de l'utilisateur
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

// Récupérer les messages d'une conversation
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

// Envoyer un nouveau message
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
        
        // Émet le nouveau message à tous les clients connectés à cette conversation
        io.to(id).emit('receive_message', newMessage);

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
httpServer.listen(PORT, () => {
    console.log(`Le serveur écoute sur le port ${PORT}`);
});
