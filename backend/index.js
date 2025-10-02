// Fichier : backend/index.js

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// Importe les modules nécessaires
const authMiddleware = require('./middleware/auth');
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

// Configuration et connexion à la base de données
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB réussie!'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Initialisation de l'application Express
const app = express();
const server = http.createServer(app); // Création du serveur HTTP pour le WebSocket

// Middleware (traitement des requêtes)
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://mon-app-g-house.vercel.app' : '*', // 🔑 Mettez votre domaine Vercel ici
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Express doit savoir comment traiter les requêtes JSON
app.use(express.json());

// ----------------------------------------------------
// DÉBUT DES ROUTES API
// ----------------------------------------------------

// ------------------- AUTHENTIFICATION -------------------

// Route d'inscription
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation simple
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }

        // Vérification de l'existence de l'utilisateur
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
        }

        // Création du nouvel utilisateur (le middleware pre-save hache le mot de passe)
        const newUser = new User({ name, email, password, role });
        await newUser.save();

        res.status(201).json({ message: 'Inscription réussie !' });

    } catch (error) {
        console.error("Erreur d'inscription:", error);
        res.status(500).json({ message: "Erreur lors de l'inscription." });
    }
});

// Route de connexion
app.post('/api/login', async (req, res) => {
    try {
        // 🔑 CORRECTION APPLIQUÉE : On déstructure explicitement l'email et le mot de passe
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Veuillez fournir un email et un mot de passe.' });
        }

        // 1. Trouver l'utilisateur par email
        const user = await User.findOne({ email });

        // 2. Vérifier l'existence de l'utilisateur et le mot de passe
        if (!user || !(await bcrypt.compare(password, user.password))) {
            // Le message d'erreur est générique pour des raisons de sécurité
            return res.status(401).json({ message: 'Identifiants invalides. Veuillez vérifier votre email et mot de passe.' });
        }

        // 3. Générer le Token JWT
        // Le token contient l'ID, le rôle, le nom et l'email.
        const token = jwt.sign(
            { userId: user._id, role: user.role, name: user.name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 4. Succès de la connexion
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
        // 🛑 L'erreur de CastError arrive ici si on ne destructure pas.
        console.error("Erreur de connexion:", error);
        // Le message d'erreur du frontend "Erreur lors de la connexion. Vérifiez vos identifiants." sera affiché.
        res.status(500).json({ message: 'Erreur lors de la connexion.' });
    }
});


// ------------------- LOGEMENTS (HOUSING) -------------------

// Route pour créer un logement (Protégée : Landlord uniquement)
app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul un propriétaire peut créer une annonce.' });
    }

    try {
        const { title, description, price, type, amenities, address, city, zipCode } = req.body;
        const images = req.files;

        if (!title || !description || !price || !city || !images || images.length === 0) {
            return res.status(400).json({ message: 'Les champs titre, description, prix, ville et au moins une image sont requis.' });
        }

        // Téléchargement des images sur Cloudinary
        const imageUrls = await Promise.all(images.map(file => {
            return new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ folder: "g-house-housing" }, (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                }).end(file.buffer);
            });
        }));

        const newHousing = new Housing({
            landlord: req.userData.userId,
            title,
            description,
            price: parseFloat(price),
            location: { address, city, zipCode },
            type,
            amenities: amenities.split(',').map(a => a.trim()),
            images: imageUrls,
        });

        await newHousing.save();
        res.status(201).json({ message: 'Annonce créée avec succès!', housing: newHousing });

    } catch (error) {
        console.error("Erreur création annonce:", error);
        res.status(500).json({ message: "Erreur lors de la création de l'annonce." });
    }
});

// Route pour lister tous les logements (Filtres optionnels)
app.get('/api/housing', async (req, res) => {
    try {
        const { city, price_min, price_max, type } = req.query;
        const filters = {};

        if (city) filters['location.city'] = { $regex: city, $options: 'i' };
        if (type) filters.type = type;

        if (price_min || price_max) {
            filters.price = {};
            if (price_min) filters.price.$gte = parseFloat(price_min);
            if (price_max) filters.price.$lte = parseFloat(price_max);
        }

        const housing = await Housing.find(filters).populate('landlord', 'name email');
        res.status(200).json({ housing });

    } catch (error) {
        console.error("Erreur liste logements:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des annonces.' });
    }
});

// Route pour lister les logements d'un utilisateur (Protégée)
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const housing = await Housing.find({ landlord: userId }).populate('landlord', 'name email');
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur logements utilisateur:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération de vos annonces.' });
    }
});

// Route pour obtenir les détails d'un logement
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur détails logement:", error);
        res.status(500).json({ message: "Erreur lors de la récupération de l'annonce." });
    }
});

// Route pour modifier un logement (Protégée : Landlord et propriétaire de l'annonce)
app.put('/api/housing/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul un propriétaire peut modifier une annonce.' });
    }

    try {
        const housing = await Housing.findById(req.params.id);
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }

        // Vérifier que l'utilisateur est bien le propriétaire de l'annonce
        if (housing.landlord.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        const { title, description, price, type, amenities, address, city, zipCode } = req.body;
        const newImages = req.files;

        // Si de nouvelles images sont fournies, les télécharger et remplacer les anciennes
        let imageUrls = housing.images;
        if (newImages && newImages.length > 0) {
            // Téléchargement des nouvelles images sur Cloudinary
            imageUrls = await Promise.all(newImages.map(file => {
                return new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream({ folder: "g-house-housing" }, (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    }).end(file.buffer);
                });
            }));
        }

        // Mise à jour des champs
        housing.title = title || housing.title;
        housing.description = description || housing.description;
        housing.price = parseFloat(price) || housing.price;
        housing.location = {
            address: address || housing.location.address,
            city: city || housing.location.city,
            zipCode: zipCode || housing.location.zipCode,
        };
        housing.type = type || housing.type;
        housing.amenities = amenities ? amenities.split(',').map(a => a.trim()) : housing.amenities;
        housing.images = imageUrls; // Mettre à jour avec les nouvelles URLs

        await housing.save();
        res.status(200).json({ message: 'Annonce mise à jour avec succès.', housing });

    } catch (error) {
        console.error("Erreur modification annonce:", error);
        res.status(500).json({ message: "Erreur lors de la modification de l'annonce." });
    }
});

// Route pour supprimer un logement (Protégée : Landlord et propriétaire de l'annonce)
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul un propriétaire peut supprimer une annonce.' });
    }
    try {
        const housing = await Housing.findById(req.params.id);
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }

        if (housing.landlord.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        await housing.deleteOne(); // Utiliser deleteOne() sur le document trouvé
        res.status(200).json({ message: 'Annonce supprimée avec succès.' });

    } catch (error) {
        console.error("Erreur suppression annonce:", error);
        res.status(500).json({ message: "Erreur lors de la suppression de l'annonce." });
    }
});


// ------------------- RÉSERVATIONS (BOOKING) -------------------

// Route pour créer la session de paiement Stripe (Protégée : Locataire)
app.post('/api/create-booking-session', authMiddleware, async (req, res) => {
    if (req.userData.role !== 'tenant') {
        return res.status(403).json({ message: 'Accès refusé. Seul un locataire peut effectuer une réservation.' });
    }
    try {
        const { housingId, startDate, endDate, totalPrice, days, landlordId } = req.body;
        const tenantId = req.userData.userId;

        // 1. Validation de base
        if (!housingId || !startDate || !endDate || !totalPrice || !days || !landlordId || days <= 0) {
            return res.status(400).json({ message: 'Données de réservation incomplètes ou invalides.' });
        }

        // 2. Création de la réservation en statut 'pending'
        const newBooking = new Booking({
            housing: housingId,
            tenant: tenantId,
            landlord: landlordId,
            startDate,
            endDate,
            price: totalPrice,
            days,
            status: 'pending', // Statut initial
        });

        await newBooking.save();

        // 3. Création de l'objet Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Réservation Logement (ID: ${housingId})`,
                            description: `Du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()} (${days} jours)`
                        },
                        // Stripe utilise des centimes, donc multiplier par 100
                        unit_amount: Math.round(totalPrice * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URL de redirection après paiement réussi (le backend envoie l'ID de la nouvelle booking)
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
            // URL de redirection en cas d'échec
            cancel_url: `${process.env.FRONTEND_URL}/housing/${housingId}`,
            // Stocker l'ID de la réservation dans les metadata pour le webhook
            metadata: {
                bookingId: newBooking._id.toString()
            }
        });

        // 4. Réponse avec l'ID de la session Stripe
        res.status(200).json({ id: session.id, bookingId: newBooking._id });

    } catch (error) {
        console.error("Erreur création session Stripe:", error);
        res.status(500).json({ message: 'Erreur lors du traitement du paiement.' });
    }
});

// Route pour récupérer les réservations (Protégée : Locataire ou Propriétaire)
app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const role = req.userData.role;

        let bookings;

        if (role === 'landlord') {
            // Propriétaire : Récupère les réservations pour ses logements
            bookings = await Booking.find({ landlord: userId })
                .populate('housing', 'title images') // Populer les infos de l'annonce
                .populate('tenant', 'name email'); // Populer les infos du locataire

        } else {
            // Locataire : Récupère les réservations qu'il a faites
            bookings = await Booking.find({ tenant: userId })
                .populate('housing', 'title images')
                .populate('landlord', 'name email');
        }

        res.status(200).json({ bookings });

    } catch (error) {
        console.error("Erreur récupération réservations:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des réservations.' });
    }
});

// Route pour mettre à jour le statut d'une réservation (Protégée : Landlord uniquement)
app.put('/api/bookings/:id/status', authMiddleware, async (req, res) => {
    if (req.userData.role !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul le propriétaire peut modifier le statut des réservations.' });
    }

    try {
        const { status } = req.body;
        const validStatuses = ['confirmed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        // Vérification de la propriété de la réservation
        if (booking.landlord.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Cette réservation ne vous appartient pas.' });
        }

        booking.status = status;
        await booking.save();

        // ⚠️ Envoi d'une notification au locataire à implémenter ici

        res.status(200).json({ message: `Statut de la réservation mis à jour en ${status}.`, booking });

    } catch (error) {
        console.error("Erreur mise à jour statut réservation:", error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du statut de la réservation.' });
    }
});

// ------------------- WEBHOOK STRIPE -------------------

// Stripe CLI ou Render Webhook URL doit pointer ici
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Erreur Webhook Stripe: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gérer l'événement 'checkout.session.completed'
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const bookingId = session.metadata.bookingId;
        const paymentStatus = session.payment_status;

        if (paymentStatus === 'paid' && bookingId) {
            try {
                // Mettre à jour la réservation sur notre base de données
                const booking = await Booking.findById(bookingId);
                if (booking && booking.status === 'pending') {
                    // Le statut est mis à 'paid', le propriétaire doit encore confirmer
                    booking.status = 'awaiting_confirmation'; 
                    await booking.save();
                    
                    // ⚠️ Envoyer une notification au propriétaire pour la confirmation
                    const landlordNotification = new Notification({
                        user: booking.landlord,
                        type: 'new_booking',
                        message: `Nouvelle réservation en attente de confirmation pour votre logement (ID: ${booking.housing.toString()}).`,
                        link: `/dashboard`
                    });
                    await landlordNotification.save();
                }
            } catch (error) {
                console.error('Erreur traitement Webhook (DB Update):', error);
                // Si l'erreur se produit ici, Stripe ne réessaiera pas. L'intervention manuelle est requise.
            }
        }
    }

    // Répondre à Stripe
    res.json({ received: true });
});


// ------------------- DOCUMENTS DE PROFIL -------------------

// Route pour télécharger un document (Protégée)
app.post('/api/user/documents', authMiddleware, upload.single('document'), async (req, res) => {
    try {
        const { docType } = req.body;
        const userId = req.userData.userId;
        const file = req.file;

        if (!docType || !file) {
            return res.status(400).json({ message: 'Le type de document et le fichier sont requis.' });
        }

        // Téléchargement sur Cloudinary (dans un dossier spécifique à l'utilisateur)
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({
                folder: `g-house-users/${userId}/documents`,
                resource_type: "auto", // Accepte PDF, image, etc.
                public_id: docType.toLowerCase().replace(/\s/g, '_'), // Nom du fichier
            }, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }).end(file.buffer);
        });

        // Chercher et mettre à jour ou créer le document
        const profileDoc = await ProfileDoc.findOneAndUpdate(
            { user: userId, docType: docType },
            { 
                url: result.secure_url,
                cloudinaryId: result.public_id,
                uploadedAt: Date.now()
            },
            { new: true, upsert: true } // Crée si n'existe pas
        );

        res.status(200).json({ message: 'Document téléchargé et enregistré avec succès.', document: profileDoc });

    } catch (error) {
        console.error("Erreur upload document:", error);
        res.status(500).json({ message: "Erreur lors du téléchargement du document." });
    }
});

// Route pour lister les documents (Protégée)
app.get('/api/user/documents', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const documents = await ProfileDoc.find({ user: userId });
        res.status(200).json({ documents });
    } catch (error) {
        console.error("Erreur liste documents:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des documents.' });
    }
});


// ------------------- CONVERSATIONS & MESSAGES -------------------

// Route pour démarrer/récupérer une conversation (Protégée)
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { recipientId, housingId } = req.body;
        const senderId = req.userData.userId;

        if (senderId === recipientId) {
            return res.status(400).json({ message: 'Impossible de démarrer une conversation avec soi-même.' });
        }

        // Chercher une conversation existante entre les deux participants, potentiellement liée à un logement
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
            housing: housingId || null // Si housingId n'est pas fourni, cherche une conversation sans logement
        });

        if (!conversation) {
            // Créer une nouvelle conversation
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId,
            });
            await conversation.save();
        }

        // Répondre avec la conversation (nouvelle ou existante)
        // Populer les participants pour donner le nom au frontend
        await conversation.populate('participants', 'name');
        res.status(200).json({ conversation });

    } catch (error) {
        console.error("Erreur démarrage conversation:", error);
        res.status(500).json({ message: 'Une erreur est survenue lors du démarrage de la conversation.' });
    }
});

// Route pour récupérer la liste des conversations de l'utilisateur (Protégée)
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;

        // Récupérer toutes les conversations où l'utilisateur est participant
        const conversations = await Conversation.find({ participants: userId })
            // Populer les participants pour obtenir le nom de l'interlocuteur
            .populate('participants', 'name')
            // Populer le logement lié à la conversation
            .populate('housing', 'title')
            // Trier par date de dernière mise à jour
            .sort({ updatedAt: -1 });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error("Erreur liste conversations:", error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des conversations.' });
    }
});

// Route pour récupérer les messages d'une conversation (Protégée)
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;

        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
        }

        // Récupérer les messages et populer l'expéditeur
        const messages = await Message.find({ conversation: id }).populate('sender', 'name');
        res.status(200).json({ messages });
    } catch (error) {
        console.error("Erreur messages:", error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des messages.' });
    }
});


// ------------------- NOTIFICATIONS -------------------

// Route pour récupérer les notifications de l'utilisateur (Protégée)
app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        // Récupérer les notifications non lues, triées par date de création descendante
        const notifications = await Notification.find({ user: userId, isRead: false }).sort({ createdAt: -1 });
        res.status(200).json({ notifications });
    } catch (error) {
        console.error("Erreur notifications:", error);
        res.status(500).json({ message: 'Erreur lors de la récupération des notifications.' });
    }
});

// Route pour marquer une notification comme lue (Protégée)
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ message: 'Notification non trouvée.' });
        }

        // Vérifier que l'utilisateur est bien le destinataire
        if (notification.user.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }

        notification.isRead = true;
        await notification.save();

        res.status(200).json({ message: 'Notification marquée comme lue.' });
    } catch (error) {
        console.error("Erreur lecture notification:", error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du statut de la notification.' });
    }
});


// ------------------- WEBSOCKETS (MESSAGERIE) -------------------

const wss = new WebSocket.Server({ server });
const userWsMap = new Map(); // Map pour stocker userId -> WebSocket

// Middleware pour la connexion WebSocket (vérification du token)
const wsAuth = (ws, req, next) => {
    const token = req.url.split('token=')[1];

    if (!token) {
        ws.close(1008, 'Token manquant');
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userData = decoded; // Ajout des données utilisateur à l'objet de requête
        next();
    } catch (error) {
        ws.close(1008, 'Token invalide');
    }
};

// Application du middleware de vérification du token aux connexions WebSocket
wss.on('connection', (ws, req) => {
    // 1. Appel du middleware d'authentification WebSocket
    wsAuth(ws, req, () => {
        // L'authentification a réussi, on peut continuer
        const userId = req.userData.userId;
        userWsMap.set(userId, ws); // Associer le userId à l'instance WebSocket
        console.log(`Utilisateur connecté via WebSocket: ${userId}`);

        // 2. Réception des messages
        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'SEND_MESSAGE') {
                    const { conversationId, content, recipientId } = data.payload;

                    if (!conversationId || !content || !recipientId) {
                        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Message invalide.' }));
                    }

                    // 3. Sauvegarde du message en base de données
                    const newMessage = new Message({
                        conversation: conversationId,
                        sender: userId,
                        content: content.trim(),
                    });
                    await newMessage.save();

                    // Mettre à jour la date de la conversation pour le tri
                    await Conversation.findByIdAndUpdate(conversationId, { updatedAt: Date.now() });

                    // Construire l'objet à envoyer aux clients
                    const messageToSend = {
                        type: 'NEW_MESSAGE',
                        payload: {
                            _id: newMessage._id,
                            content: newMessage.content,
                            sender: { _id: userId, name: req.userData.name }, // L'expéditeur est l'utilisateur actuel
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