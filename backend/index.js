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

// Middleware CORS
app.use(cors());

// Middleware pour analyser les requêtes JSON
app.use(express.json());

// Définition de la route d'inscription
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation des données
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }

        // Hachage du mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role,
        });

        await newUser.save();

        res.status(201).json({ message: 'Inscription réussie ! Vous pouvez maintenant vous connecter.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'inscription.' });
    }
});

// Définition de la route de connexion
app.post('/api/login', async (req, res) => {
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

        const token = jwt.sign(
            { userId: user._id, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la connexion.' });
    }
});

// Routes existantes
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
        const housing = await Housing.findById(req.params.id).populate('landlord', 'name');
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
        if (req.userData.role !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent créer des annonces.' });
        }

        const { title, description, type, price, location, amenities } = req.body;
        const parsedLocation = JSON.parse(location);

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Au moins une image est requise.' });
        }

        const imageUrls = await Promise.all(req.files.map(async (file) => {
            const result = await cloudinary.uploader.upload(`data:image/jpeg;base64,${file.buffer.toString('base64')}`, {
                folder: 'g-house'
            });
            return result.secure_url;
        }));

        const newHousing = new Housing({
            title,
            description,
            type,
            price: parseFloat(price),
            location: parsedLocation,
            amenities: amenities ? amenities.split(',').map(item => item.trim()) : [],
            images: imageUrls,
            landlord: req.userData.userId
        });

        await newHousing.save();
        res.status(201).json({ message: 'Annonce créée avec succès!', housing: newHousing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la création de l\'annonce.' });
    }
});

app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const userHousing = await Housing.find({ landlord: userId });
        res.status(200).json({ housing: userHousing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération de vos annonces.' });
    }
});

app.put('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }

        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        const { title, description, type, price, location, amenities } = req.body;
        const updateData = {
            title,
            description,
            type,
            price,
            location,
            amenities: amenities ? amenities.split(',').map(item => item.trim()) : [],
        };

        const updatedHousing = await Housing.findByIdAndUpdate(id, updateData, { new: true });
        res.status(200).json({ message: 'Annonce mise à jour avec succès.', housing: updatedHousing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour de l\'annonce.' });
    }
});

app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }

        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        await Housing.findByIdAndDelete(id);
        res.status(200).json({ message: 'Annonce supprimée avec succès.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la suppression de l\'annonce.' });
    }
});

app.post('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const { housingId, startDate, endDate } = req.body;
        const tenantId = req.userData.userId;

        // Vérifiez si le logement existe et n'est pas déjà réservé pour ces dates
        const existingBooking = await Booking.findOne({
            housing: housingId,
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
            ]
        });

        if (existingBooking) {
            return res.status(409).json({ message: 'Ce logement est déjà réservé pour les dates demandées.' });
        }

        const newBooking = new Booking({
            housing: housingId,
            tenant: tenantId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: 'pending' // En attente de confirmation
        });

        await newBooking.save();
        res.status(201).json({ message: 'Réservation créée avec succès.', booking: newBooking });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la création de la réservation.' });
    }
});

app.get('/api/user/bookings', authMiddleware, async (req, res) => {
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

app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const conversations = await Conversation.find({ participants: userId }).populate('participants', 'name').populate('housing', 'title');
        res.status(200).json({ conversations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des conversations.' });
    }
});

app.get('/api/conversations/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;
        const conversation = await Conversation.findById(id).populate('participants', 'name').populate('housing', 'title');
        if (!conversation || !conversation.participants.some(p => p._id.toString() === userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
        }
        res.status(200).json({ conversation });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération de la conversation.' });
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
app.listen(PORT, () => {
    console.log(`Le serveur écoute sur le port ${PORT}`);
});