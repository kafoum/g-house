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

// 🔑 INITIALISATION DE STRIPE
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
const Message = require = require('./models/Message'); // 💡 Assurez-vous que le message est importé correctement

// Crée une instance de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Crée un serveur HTTP pour Express et WebSocket
const server = http.createServer(app);

// Configurez la connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(() => console.log('Connexion à MongoDB échouée !'));


// ----------------------------------------------------
// 🔑 MIDDLEWARES (CORRECTION CORS ici pour éviter le blocage)
// ----------------------------------------------------

// 1. CONFIGURATION CORS (DOIT ÊTRE EN PREMIER)
app.use(cors({
    origin: [
        'http://localhost:5173', // Pour le développement local
        process.env.VERCEL_FRONTEND_URL // 🔑 L'URL de votre frontend Vercel (ex: https://g-house.vercel.app)
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
}));

// 2. Middleware pour parser les requêtes JSON, SAUF pour la route de webhook Stripe
app.use(express.json({
    verify: (req, res, buf) => {
        if (req.originalUrl === '/api/webhook') {
            req.rawBody = buf.toString(); // Stocke le corps non analysé pour Stripe
        }
    }
}));


// Middleware de Log (optionnel)
app.use((req, res, next) => {
    console.log(`Requête reçue: ${req.method} ${req.url}`);
    next();
});

// ----------------------------------------------------
// DÉBUT DES ROUTES API
// ----------------------------------------------------

// Route d'inscription
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // 1. Vérification de l'existence de l'utilisateur
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Cet email est déjà utilisé." });
        }

        // 2. Création du nouvel utilisateur
        const newUser = new User({ name, email, password, role });
        await newUser.save();
        
        res.status(201).json({ message: 'Inscription réussie ! Vous pouvez vous connecter.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de l\'inscription.' });
    }
});

// Route de connexion
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // 1. Validation de base
        if (!email || !password) {
            return res.status(400).json({ message: 'Veuillez fournir un email et un mot de passe.' });
        }
        // 1. Trouver l'utilisateur
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // 2. Comparer le mot de passe
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // 3. Générer le JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({ message: 'Connexion réussie', token, role: user.role, userId: user._id });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la connexion.' });
    }
});


// ----------------------------------------------------
// 🔑 STRIPE PAYMENT ROUTES
// ----------------------------------------------------

// Route protégée pour créer une session de paiement Stripe
app.post('/api/bookings/:housingId/create-session', authMiddleware, async (req, res) => {
    const { housingId } = req.params;
    const { startDate, endDate, totalPrice } = req.body; 
    const tenantId = req.userData.userId; // ID du locataire connecté
    
    // Stripe travaille en centimes
    const amountInCents = Math.round(totalPrice * 100); 

    if (amountInCents <= 50) { 
        return res.status(400).json({ message: 'Le montant minimum est de 0.50 €.' });
    }

    try {
        // 1. Vérifier l'existence du logement
        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        
        // 2. Créer une réservation "Pending" (En Attente) dans la base de données
        const newBooking = new Booking({
            tenant: tenantId,
            housing: housingId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: 'pending', 
        });
        await newBooking.save();

        // 3. Créer la session Stripe Checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: `Réservation: ${housing.title}`,
                            description: `Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
                        },
                        unit_amount: amountInCents, 
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URLs de redirection (Doivent pointer vers votre Vercel Frontend URL)
            success_url: `${process.env.VERCEL_FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
            cancel_url: `${process.env.VERCEL_FRONTEND_URL}/housing/${housingId}?cancelled=true`,
            
            // Métadonnées pour le Webhook
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: tenantId,
            }
        });

        // 4. Renvoyer l'ID de session au frontend
        res.status(200).json({ sessionId: session.id, bookingId: newBooking._id });

    } catch (error) {
        console.error("Erreur Stripe ou DB:", error);
        res.status(500).json({ message: 'Échec de la création de la session de paiement.', error: error.message });
    }
});

// 🔑 ROUTE DE WEBHOOK STRIPE (NON PROTÉGÉE)
app.post('/api/webhook', async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        // Construction de l'événement Stripe (nécessite le corps brut)
        event = stripe.webhooks.constructEvent(req.rawBody, signature, endpointSecret);
    } catch (err) {
        console.error(`⚠️ Erreur de signature du Webhook : ${err.message}`);
        return res.status(400).send(`Erreur de signature du Webhook : ${err.message}`);
    }

    // Gestion des événements
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const bookingId = session.metadata.bookingId;

            if (session.payment_status === 'paid') {
                try {
                    // Mettre à jour la réservation dans la DB de 'pending' à 'confirmed'
                    const confirmedBooking = await Booking.findOneAndUpdate(
                        { _id: bookingId, status: 'pending' },
                        { status: 'confirmed' },
                        { new: true }
                    ).populate('housing');
                    
                    if (confirmedBooking) {
                        console.log(`Réservation ${bookingId} confirmée.`);
                        
                        // Créer une notification pour le propriétaire
                        await Notification.create({
                            recipient: confirmedBooking.housing.landlord,
                            message: `Nouvelle réservation CONFIRMÉE pour votre logement: ${confirmedBooking.housing.title}.`,
                            type: 'booking_confirmed'
                        });
                    }
                } catch (dbError) {
                    console.error('Erreur DB lors de la confirmation de la réservation:', dbError);
                }
            }
            break;

        case 'checkout.session.async_payment_failed':
            const failedSession = event.data.object;
            const failedBookingId = failedSession.metadata.bookingId;
            await Booking.findOneAndUpdate({ _id: failedBookingId }, { status: 'cancelled' });
            console.log(`Réservation ${failedBookingId} annulée suite à l'échec du paiement asynchrone.`);
            break;

        default:
            console.log(`Événement non géré : ${event.type}`);
    }

    // Réponse à Stripe : doit toujours renvoyer 200
    res.status(200).json({ received: true });
});


// ----------------------------------------------------
// ROUTES LOGEMENT (Exemple de vos routes existantes)
// ----------------------------------------------------

// Route de création de logement
app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    // ... (Votre logique de création/upload existante) ...
    try {
        const { title, description, price, city, address, zipCode, type, amenities } = req.body;
        const landlordId = req.userData.userId; 

        // 1. Upload des images vers Cloudinary
        const uploadPromises = req.files.map(file => {
            return cloudinary.uploader.upload(
                `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
            );
        });
        const uploadResults = await Promise.all(uploadPromises);
        const imageUrls = uploadResults.map(result => result.secure_url);

        // 2. Création du logement
        const newHousing = new Housing({
            title,
            description,
            price,
            location: { city, address, zipCode },
            type,
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            landlord: landlordId,
            images: imageUrls
        });
        await newHousing.save();

        res.status(201).json({ message: 'Annonce créée avec succès !', housing: newHousing });

    } catch (error) {
        console.error('Erreur lors de la création du logement:', error);
        res.status(500).json({ message: 'Échec de la création du logement.' });
    }
});

// Route de modification de logement
app.put('/api/housing/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    // ... (Votre logique de modification existante) ...
    try {
        const { id } = req.params;
        const landlordId = req.userData.userId;
        const { title, description, price, city, address, zipCode, type, amenities } = req.body;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        if (housing.landlord.toString() !== landlordId.toString()) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        let imageUrls = housing.images;
        // Si de nouvelles images sont uploadées, on les ajoute/remplace
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => {
                return cloudinary.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
                );
            });
            const uploadResults = await Promise.all(uploadPromises);
            imageUrls = uploadResults.map(result => result.secure_url);
            // Pour l'instant, on remplace juste les anciennes images
        }

        const updatedHousing = await Housing.findByIdAndUpdate(id, {
            title,
            description,
            price,
            location: { city, address, zipCode },
            type,
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            images: imageUrls
        }, { new: true });

        res.status(200).json({ message: 'Annonce mise à jour avec succès !', housing: updatedHousing });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du logement:', error);
        res.status(500).json({ message: 'Échec de la mise à jour du logement.' });
    }
});

// Route de suppression de logement
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    // ... (Votre logique de suppression existante) ...
    try {
        const { id } = req.params;
        const landlordId = req.userData.userId;

        const housing = await Housing.findById(id);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        if (housing.landlord.toString() !== landlordId.toString()) {
            return res.status(403).json({ message: 'Accès refusé.' });
        }

        await Housing.findByIdAndDelete(id);
        res.status(200).json({ message: 'Annonce supprimée avec succès.' });

    } catch (error) {
        console.error('Erreur lors de la suppression du logement:', error);
        res.status(500).json({ message: 'Échec de la suppression du logement.' });
    }
});


// Route pour récupérer tous les logements
app.get('/api/housing', async (req, res) => {
    // ... (Votre logique de liste et de filtrage existante) ...
    try {
        const { city, type, price_min, price_max } = req.query;
        let query = {};

        if (city) {
            query['location.city'] = new RegExp(city, 'i'); // Recherche insensible à la casse
        }
        if (type) {
            query.type = type;
        }
        if (price_min || price_max) {
            query.price = {};
            if (price_min) {
                query.price.$gte = parseInt(price_min);
            }
            if (price_max) {
                query.price.$lte = parseInt(price_max);
            }
        }

        const housing = await Housing.find(query).limit(20);
        res.status(200).json({ housing });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des annonces.' });
    }
});

// Route pour récupérer un logement par ID
app.get('/api/housing/:id', async (req, res) => {
    // ... (Votre logique de détail existante) ...
    try {
        const { id } = req.params;
        const housing = await Housing.findById(id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération du logement.' });
    }
});


// ----------------------------------------------------
// ROUTES MESSAGERIE
// ----------------------------------------------------

// Route pour démarrer ou retrouver une conversation avec un propriétaire
app.post('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const { housingId, recipientId, subject } = req.body;
        const senderId = req.userData.userId;

        // Tente de trouver une conversation existante pour ce logement et ces participants
        let conversation = await Conversation.findOne({
            housing: housingId,
            participants: { $all: [senderId, recipientId] }
        });

        if (!conversation) {
            // Créer une nouvelle conversation
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId,
                subject: subject || 'Conversation sans sujet'
            });
            await conversation.save();
        }

        res.status(200).json({ conversationId: conversation._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Échec de la création/récupération de la conversation.' });
    }
});

// Route pour lister les conversations de l'utilisateur
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;

        const conversations = await Conversation.find({
            participants: userId
        })
        .populate('participants', 'name')
        .sort({ createdAt: -1 });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des conversations.' });
    }
});

// Route pour récupérer les messages d'une conversation
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

// ----------------------------------------------------
// FIN DES ROUTES API
// ----------------------------------------------------

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