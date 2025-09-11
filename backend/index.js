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
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// Crée une instance de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Crée un serveur HTTP et y attache l'application Express
const server = http.createServer(app);

// Configurez le serveur Socket.IO avec les options CORS
const io = new Server(server, {
    cors: {
        origin: "*", // Permet les connexions depuis n'importe quelle origine (ajuster si nécessaire)
        methods: ["GET", "POST"]
    }
});

// Middleware CORS
app.use(cors());

// Middleware pour analyser les requêtes JSON
app.use(express.json());

// Connexion à la base de données
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connecté à la base de données MongoDB'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Routes WebSocket
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté via WebSocket');

    // Écoute l'événement 'joinConversation' pour rejoindre une salle de discussion
    socket.on('joinConversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`L'utilisateur a rejoint la conversation : ${conversationId}`);
    });

    // Écoute l'événement 'sendMessage'
    socket.on('sendMessage', async (messageData) => {
        try {
            const { conversationId, senderId, content } = messageData;

            // Vérifie que l'expéditeur a l'autorisation
            const conversation = await Conversation.findById(conversationId);
            if (!conversation || !conversation.participants.includes(senderId)) {
                console.error('Accès refusé. L\'utilisateur n\'est pas un participant.');
                return;
            }

            // Crée et enregistre le nouveau message dans la base de données
            const newMessage = new Message({
                conversation: conversationId,
                sender: senderId,
                content: content,
            });

            await newMessage.save();

            // Peuple le sender pour l'envoi
            await newMessage.populate('sender', 'name');

            // Émet le nouveau message à tous les clients dans la conversation
            io.to(conversationId).emit('receiveMessage', newMessage);
            console.log('Message émis avec succès via WebSocket !');

        } catch (error) {
            console.error('Erreur lors de l\'envoi du message via WebSocket:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté du WebSocket');
    });
});

// Route pour l'enregistrement d'un utilisateur
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword, role });
        await user.save();
        res.status(201).json({ message: 'Utilisateur enregistré avec succès !' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'enregistrement.' });
    }
});

// Route pour la connexion d'un utilisateur
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Mot de passe incorrect.' });
        }
        const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la connexion.' });
    }
});

// Routes de gestion des logements
app.get('/api/housing', async (req, res) => {
    try {
        const housings = await Housing.find().populate('landlord', 'name');
        res.status(200).json({ housings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des logements.' });
    }
});

app.get('/api/housing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const housing = await Housing.findById(id).populate('landlord', 'name');
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération du logement.' });
    }
});

app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const { title, description, price, address } = req.body;
        const landlordId = req.userData.userId;
        const images = req.files;

        if (!title || !description || !price || !address || !images) {
            return res.status(400).json({ message: 'Tous les champs et au moins une image sont requis.' });
        }

        const imageUploadPromises = images.map(file => {
            return new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { folder: 'g-house' },
                    (error, result) => {
                        if (error) {
                            console.error("Cloudinary upload error:", error);
                            return reject(error);
                        }
                        resolve(result.secure_url);
                    }
                ).end(file.buffer);
            });
        });

        const imageUrls = await Promise.all(imageUploadPromises);

        const newHousing = new Housing({
            title,
            description,
            price,
            address,
            images: imageUrls,
            landlord: landlordId
        });

        await newHousing.save();
        res.status(201).json({ message: 'Logement créé avec succès !', housing: newHousing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la création du logement.' });
    }
});

app.get('/api/landlord-housing', authMiddleware, async (req, res) => {
    try {
        const landlordId = req.userData.userId;
        const housings = await Housing.find({ landlord: landlordId });
        res.status(200).json({ housings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des logements du propriétaire.' });
    }
});

app.put('/api/housing/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const landlordId = req.userData.userId;

        const housing = await Housing.findById(id);

        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }

        if (housing.landlord.toString() !== landlordId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de ce logement.' });
        }

        if (req.files && req.files.length > 0) {
            const imageUploadPromises = req.files.map(file => {
                return new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { folder: 'g-house' },
                        (error, result) => {
                            if (error) {
                                console.error("Cloudinary upload error:", error);
                                return reject(error);
                            }
                            resolve(result.secure_url);
                        }
                    ).end(file.buffer);
                });
            });
            const imageUrls = await Promise.all(imageUploadPromises);
            updates.images = [...housing.images, ...imageUrls];
        }

        Object.assign(housing, updates);
        await housing.save();
        res.status(200).json({ message: 'Logement mis à jour avec succès !', housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour du logement.' });
    }
});

app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const landlordId = req.userData.userId;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        if (housing.landlord.toString() !== landlordId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de ce logement.' });
        }
        await Housing.findByIdAndDelete(id);
        res.status(200).json({ message: 'Logement supprimé avec succès !' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la suppression du logement.' });
    }
});

// Routes de gestion des conversations
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { recipientId, housingId } = req.body;
        const senderId = req.userData.userId;
        const participants = [senderId, recipientId];

        let conversation = await Conversation.findOne({
            participants: { $all: participants },
            housing: housingId
        });

        if (!conversation) {
            conversation = new Conversation({ participants, housing: housingId });
            await conversation.save();
        }

        res.status(200).json({ message: 'Conversation créée ou trouvée avec succès.', conversationId: conversation._id });
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

// Routes de gestion des réservations
app.post('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const { housing, checkInDate, checkOutDate } = req.body;
        const tenant = req.userData.userId;

        const newBooking = new Booking({
            housing,
            tenant,
            checkInDate,
            checkOutDate
        });
        await newBooking.save();
        res.status(201).json({ message: 'Réservation créée avec succès !', booking: newBooking });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la création de la réservation.' });
    }
});

app.get('/api/my-bookings', authMiddleware, async (req, res) => {
    try {
        const tenantId = req.userData.userId;
        const bookings = await Booking.find({ tenant: tenantId }).populate('housing');
        res.status(200).json({ bookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération de vos réservations.' });
    }
});

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

// Route pour la documentation de l'API
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Définition de la route de test
app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

// Le serveur démarre et écoute sur le port défini
server.listen(PORT, () => {
    console.log(`Le serveur écoute sur le port ${PORT}`);
});