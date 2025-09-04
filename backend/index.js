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

// Configurez Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurez Multer pour la gestion des fichiers
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Importe les modèles que l'on vient de créer
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

// Configurez le transporteur d'e-mail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware : Permet à Express de lire le corps des requêtes en JSON
app.use(express.json());

// Connexion à la base de données MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connexion à MongoDB réussie !');
}).catch((error) => {
    console.error('Échec de la connexion à MongoDB :', error);
});

// --- Routes d'API ---

/**
 * @swagger
 * tags:
 * name: Users
 * description: Gestion des utilisateurs (inscription, connexion)
 * /api/register:
 * post:
 * summary: Inscrit un nouvel utilisateur
 * tags: [Users]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * name:
 * type: string
 * email:
 * type: string
 * password:
 * type: string
 * role:
 * type: string
 * enum: [tenant, landlord]
 * responses:
 * 201:
 * description: Utilisateur créé avec succès.
 * 400:
 * description: Erreur de validation ou email déjà utilisé.
 * 500:
 * description: Erreur serveur.
 */
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
        }
        const newUser = new User({
            name,
            email,
            password,
            role
        });
        await newUser.save();
        res.status(201).json({ message: 'Utilisateur créé avec succès !' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'inscription.' });
    }
});

/**
 * @swagger
 * /api/login:
 * post:
 * summary: Connecte un utilisateur existant
 * tags: [Users]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * email:
 * type: string
 * example: "test@example.com"
 * password:
 * type: string
 * example: "motdepasse123"
 * responses:
 * 200:
 * description: Connexion réussie, retourne un token JWT.
 * 400:
 * description: Email ou mot de passe incorrect.
 * 500:
 * description: Erreur serveur.
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email ou mot de passe incorrect.' });
        }
        const token = jwt.sign(
            { id: user._id, role: user.role, userName: user.name },
            process.env.JWT_SECRET,
            { expiresIn: '3h' }
        );
        res.status(200).json({
            message: 'Connexion réussie !',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la connexion.' });
    }
});

/**
 * @swagger
 * tags:
 * name: Housing
 * description: Gestion des annonces de logement
 * /api/housing:
 * get:
 * summary: Récupère la liste de tous les logements avec filtres
 * tags: [Housing]
 * parameters:
 * - in: query
 * name: city
 * schema:
 * type: string
 * description: Filtrer par ville.
 * - in: query
 * name: price_min
 * schema:
 * type: number
 * description: Filtrer par prix minimum.
 * - in: query
 * name: price_max
 * schema:
 * type: number
 * description: Filtrer par prix maximum.
 * - in: query
 * name: type
 * schema:
 * type: string
 * enum: [apartment, house, studio]
 * description: Filtrer par type de logement.
 * responses:
 * 200:
 * description: Une liste d'annonces de logement.
 * 500:
 * description: Erreur serveur.
 */
app.get('/api/housing', async (req, res) => {
    try {
        const query = {};
        if (req.query.city) {
            query['location.city'] = req.query.city;
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

/**
 * @swagger
 * /api/housing/{id}:
 * get:
 * summary: Récupère les détails d'une annonce spécifique
 * tags: [Housing]
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * description: L'ID de l'annonce de logement.
 * responses:
 * 200:
 * description: Détails de l'annonce.
 * 404:
 * description: Annonce non trouvée.
 * 500:
 * description: Erreur serveur.
 */
app.get('/api/housing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const housing = await Housing.findById(id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération de l\'annonce.' });
    }
});

// Route protégée pour la création d'une annonce
app.post('/api/landlord/housing', authMiddleware, async (req, res) => {
    try {
        const { title, description, price, location, type, amenities, images } = req.body;
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent créer des annonces.' });
        }
        const newHousing = new Housing({
            title,
            description,
            price,
            location,
            type,
            amenities,
            images,
            landlord: req.userData.userId
        });
        await newHousing.save();
        res.status(201).json({ message: 'Annonce créée avec succès !', housing: newHousing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la création de l\'annonce.' });
    }
});

// Route protégée pour qu'un locataire puisse faire une demande de réservation
app.post('/api/tenant/bookings', authMiddleware, async (req, res) => {
    try {
        const { housingId, startDate, endDate } = req.body;
        if (req.userData.userRole !== 'tenant') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les locataires peuvent faire des réservations.' });
        }
        const conflictingBooking = await Booking.findOne({
            housing: housingId,
            $or: [
                { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
            ]
        });
        if (conflictingBooking) {
            return res.status(409).json({ message: 'Ce logement est déjà réservé pour tout ou partie de cette période.' });
        }
        const newBooking = new Booking({
            tenant: req.userData.userId,
            housing: housingId,
            startDate,
            endDate
        });
        await newBooking.save();
        const housing = await Housing.findById(housingId);
        if (housing) {
            const landlordNotification = new Notification({
                recipient: housing.landlord,
                message: `Vous avez une nouvelle demande de réservation pour le logement "${housing.title}".`,
                type: 'new_booking'
            });
            await landlordNotification.save();
        }
        res.status(201).json({
            message: 'Demande de réservation envoyée avec succès !',
            booking: newBooking
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la création de la réservation.' });
    }
});

// Route protégée pour qu'un locataire puisse voir ses propres réservations
app.get('/api/tenant/bookings', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'tenant') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les locataires peuvent voir leurs réservations.' });
        }
        const tenantBookings = await Booking.find({ tenant: req.userData.userId }).populate('housing');
        res.status(200).json({ bookings: tenantBookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des réservations.' });
    }
});

// Route protégée pour qu'un locataire puisse ajouter un document
app.post('/api/profile/documents', authMiddleware, async (req, res) => {
    try {
        const { docType, docUrl } = req.body;
        if (req.userData.userRole !== 'tenant') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les locataires peuvent ajouter des documents à leur profil.' });
        }
        const newDoc = new ProfileDoc({
            user: req.userData.userId,
            docType,
            docUrl
        });
        await newDoc.save();
        res.status(201).json({
            message: 'Document ajouté avec succès !',
            document: newDoc
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'ajout du document.' });
    }
});

// Route protégée pour le tableau de bord propriétaire
app.get('/api/landlord/dashboard', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires ont accès à leur tableau de bord.' });
        }
        const housingList = await Housing.find({ landlord: req.userData.userId });
        const dashboardData = await Promise.all(
            housingList.map(async (housing) => {
                const pendingBookings = await Booking.find({
                    housing: housing._id,
                    status: 'pending'
                }).populate('tenant', 'name');
                return {
                    ...housing.toObject(),
                    pendingBookings: pendingBookings
                };
            })
        );
        res.status(200).json({ dashboard: dashboardData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des données du tableau de bord.' });
    }
});

// Route protégée pour récupérer toutes les annonces d'un propriétaire
app.get('/api/landlord/housing', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent voir leurs annonces.' });
        }
        const housingList = await Housing.find({ landlord: req.userData.userId });
        res.status(200).json({ housing: housingList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des annonces.' });
    }
});

// Route protégée pour qu'un propriétaire puisse voir les réservations de ses logements
app.get('/api/landlord/bookings', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent voir les réservations.' });
        }
        const landlordHousing = await Housing.find({ landlord: req.userData.userId });
        if (landlordHousing.length === 0) {
            return res.status(200).json({ bookings: [] });
        }
        const housingIds = landlordHousing.map(housing => housing._id);
        const landlordBookings = await Booking.find({ housing: { $in: housingIds } })
                                              .populate('housing')
                                              .populate('tenant', 'name email');
        res.status(200).json({ bookings: landlordBookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des réservations.' });
    }
});

// Route protégée pour qu'un propriétaire puisse mettre à jour le statut d'une réservation
app.put('/api/landlord/bookings/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent mettre à jour les réservations.' });
        }
        const booking = await Booking.findById(id).populate('housing');
        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }
        if (booking.housing.landlord.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de ce logement.' });
        }
        booking.status = status;
        await booking.save();
        const tenantNotification = new Notification({
            recipient: booking.tenant,
            message: `Le statut de votre réservation pour le logement "${booking.housing.title}" a été mis à jour : ${status}.`,
            type: `booking_${status}`
        });
        await tenantNotification.save();
        res.status(200).json({
            message: 'Statut de la réservation mis à jour avec succès !',
            booking: booking
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour du statut.' });
    }
});

// Route protégée pour mettre à jour une annonce
app.put('/api/landlord/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent modifier leurs annonces.' });
        }
        const housing = await Housing.findOne({ _id: id, landlord: req.userData.userId });
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée ou vous n\'êtes pas le propriétaire.' });
        }
        const updatedHousing = await Housing.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        res.status(200).json({
            message: 'Annonce mise à jour avec succès !',
            housing: updatedHousing
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour de l\'annonce.' });
    }
});

// Route protégée pour supprimer une annonce
app.delete('/api/landlord/housing/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent supprimer des annonces.' });
        }
        const deletedHousing = await Housing.findOneAndDelete({ _id: id, landlord: req.userData.userId });
        if (!deletedHousing) {
            return res.status(404).json({ message: 'Annonce non trouvée ou vous n\'êtes pas le propriétaire.' });
        }
        res.status(200).json({
            message: 'Annonce supprimée avec succès !',
            housing: deletedHousing
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la suppression de l\'annonce.' });
    }
});

// Route protégée pour qu'un propriétaire puisse voir les documents d'un locataire spécifique
app.get('/api/landlord/tenants/:tenantId/documents', authMiddleware, async (req, res) => {
    try {
        const { tenantId } = req.params;
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent voir les documents des locataires.' });
        }
        const landlordHousing = await Housing.find({ landlord: req.userData.userId }).select('_id');
        const housingIds = landlordHousing.map(housing => housing._id);
        const hasReservation = await Booking.findOne({
            tenant: tenantId,
            housing: { $in: housingIds }
        });
        if (!hasReservation) {
            return res.status(403).json({ message: 'Accès refusé. Aucune réservation trouvée entre vous et ce locataire.' });
        }
        const documents = await ProfileDoc.find({ user: tenantId });
        res.status(200).json({ documents: documents });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des documents.' });
    }
});

// Route protégée pour qu'un utilisateur puisse voir ses notifications
app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.userData.userId }).sort({ createdAt: -1 });
        res.status(200).json({ notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des notifications.' });
    }
});

// Route protégée pour qu'un utilisateur puisse marquer une notification comme lue
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);
        if (!notification || notification.recipient.toString() !== req.userData.userId) {
            return res.status(404).json({ message: 'Notification non trouvée ou vous n\'avez pas la permission.' });
        }
        notification.isRead = true;
        await notification.save();
        res.status(200).json({ message: 'Notification marquée comme lue.', notification });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la mise à jour de la notification.' });
    }
});

// Route protégée pour le téléversement de documents
app.post('/api/upload/documents', authMiddleware, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier fourni.' });
        }
        const result = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`, {
            folder: 'g-house-documents'
        });
        res.status(200).json({ message: 'Document téléversé avec succès.', url: result.secure_url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors du téléversement du document.' });
    }
});

// Route pour envoyer un nouveau message ou démarrer une conversation
app.post('/api/messages', authMiddleware, async (req, res) => {
    try {
        const { recipientId, housingId, content } = req.body;
        const senderId = req.userData.userId;
        const senderName = req.userData.userName;
        let conversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [senderId, recipientId] }
        });
        if (!conversation) {
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId
            });
            await conversation.save();
        }
        const message = new Message({
            conversation: conversation._id,
            sender: senderId,
            content
        });
        await message.save();
        const notification = new Notification({
            recipient: recipientId,
            message: `Vous avez un nouveau message de ${senderName}.`,
            type: 'new_message'
        });
        await notification.save();
        const recipientUser = await User.findById(recipientId);
        if (recipientUser) {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: recipientUser.email,
                subject: 'Nouveau message sur G-House',
                text: `Bonjour ${recipientUser.name},\n\nVous avez un nouveau message de ${senderName} sur G-House. Connectez-vous à l'application pour le consulter.`,
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error('Erreur lors de l\'envoi de l\'e-mail :', error);
                } else {
                    console.log('E-mail envoyé :', info.response);
                }
            });
        }
        res.status(201).json({ message: 'Message envoyé avec succès.', message: message });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de l\'envoi du message.' });
    }
});

// Route pour lister toutes les conversations d'un utilisateur
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const conversations = await Conversation.find({ participants: userId })
                                               .populate('participants', 'name')
                                               .populate('housing', 'title images');
        res.status(200).json({ conversations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des conversations.' });
    }
});

// Route pour récupérer tous les messages d'une conversation
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
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
    console.log(`URL : http://localhost:${PORT}`);
});