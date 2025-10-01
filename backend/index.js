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
const cors = require('cors'); // 🔑 GARDER LA DÉCLARATION UNIQUE ICI

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
const Message = require('./models/Message');

// Crée une instance de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Crée un serveur HTTP pour Express et WebSocket
const server = http.createServer(app);

// Configurez la connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(() => console.log('Connexion à MongoDB échouée !'));

// 🔑 CONFIGURATION CORS (Doit être avant le middleware JSON)
app.use(cors({
    origin: [
        'http://localhost:5173', // Pour le développement local
        process.env.VERCEL_FRONTEND_URL // L'URL de votre frontend déployé sur Vercel
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
}));

// 🔑 Middleware pour parser les requêtes JSON, SAUF pour la route de webhook Stripe
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
    // ... (Votre logique d'inscription existante) ...
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
    // ... (Votre logique de connexion existante) ...
    try {
        const { email, password } = req.body;

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
// 🔑 STRIPE PAYMENT ROUTES (NOUVELLES ROUTES)
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

// 🔑 ROUTE DE WEBHOOK STRIPE (NON PROTÉGÉE par authMiddleware)
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
// FIN DES ROUTES API (Votre logique existante)
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