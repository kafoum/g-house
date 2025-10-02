// Fichier : backend/index.js

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================
// 1. IMPORTS DES MODULES ET INITIALISATION
// ====================================================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Utilisé pour hacher et comparer les mots de passe
const jwt = require('jsonwebtoken');

// Services externes
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const http = require('http'); // Pour le serveur HTTP
const WebSocket = require('ws'); // Pour le serveur WebSocket

// Middleware et Documentation
const authMiddleware = require('./middleware/auth');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); // Assurez-vous d'avoir ce fichier

// Importe les modèles Mongoose
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// --- Configuration ---
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.VERCEL_FRONTEND_URL || 'https://g-house.vercel.app'; // URL de votre application React

// Configurez Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configurez Multer pour la gestion des fichiers en mémoire (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Middlewares Globaux ---
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json()); // Permet de lire les corps de requête JSON

// ====================================================================
// 2. CONNEXION À LA BASE DE DONNÉES
// ====================================================================
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connexion à MongoDB établie avec succès'))
.catch(err => console.error('Erreur de connexion à MongoDB:', err.message));


// ====================================================================
// 3. ROUTES D'AUTHENTIFICATION (Auth)
// ====================================================================

// Inscription d'un nouvel utilisateur
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Validation simple
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
        }

        const user = new User({ name, email, password, role });
        await user.save();

        res.status(201).json({ message: 'Inscription réussie. Vous pouvez maintenant vous connecter.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
    }
});

// Connexion d'un utilisateur
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: 'Identifiants invalides.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Identifiants invalides.' });
        }

        // Créer le token JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Envoyer les données de l'utilisateur (sans le mot de passe) et le token
        res.status(200).json({
            token,
            user: {
                userId: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});


// ====================================================================
// 4. ROUTES D'ANNONCES DE LOGEMENT (Housing)
// ====================================================================

// POST /api/housing : Créer une nouvelle annonce (Propriétaire uniquement)
app.post('/api/user/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent créer des annonces.' });
    }

    try {
        const { title, description, price, address, city, zipCode, type, amenities } = req.body;
        const landlordId = req.userData.userId;
        let imageUrls = [];

        // 1. Upload des images sur Cloudinary
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI);
                imageUrls.push(result.secure_url);
            }
        }

        // 2. Création de l'annonce
        const newHousing = new Housing({
            title,
            description,
            price: Number(price),
            location: { address, city, zipCode },
            type,
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            landlord: landlordId,
            images: imageUrls,
            // Le statut 'active' est défini par défaut dans le modèle.
        });

        await newHousing.save();
        res.status(201).json({ message: 'Annonce créée avec succès', housing: newHousing });

    } catch (error) {
        console.error("Erreur lors de la création de l'annonce:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de l\'annonce.' });
    }
});

// GET /api/housing : Récupérer toutes les annonces actives (Public)
app.get('/api/housing', async (req, res) => {
    try {
        // 🔑 IMPORTANT : Ne récupérer que les annonces avec status: 'active'
        const housingList = await Housing.find({ status: 'active' }).populate('landlord', 'name email');
        res.status(200).json({ housing: housingList });
    } catch (error) {
        console.error("Erreur sur GET /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des annonces.' });
    }
});

// GET /api/housing/:id : Récupérer les détails d'une annonce (Public)
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id).populate('landlord', 'name email');
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// GET /api/user/housing : Récupérer les annonces du propriétaire connecté (Propriétaire uniquement)
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent voir leurs annonces.' });
    }
    try {
        const housingList = await Housing.find({ landlord: req.userData.userId });
        res.status(200).json({ housing: housingList });
    } catch (error) {
        console.error("Erreur sur GET /api/user/housing :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de vos annonces.' });
    }
});

// PUT /api/user/housing/:id : Modifier une annonce (Propriétaire uniquement)
app.put('/api/user/housing/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé.' });
    }

    try {
        const housingId = req.params.id;
        const userId = req.userData.userId;
        const { title, description, price, address, city, zipCode, type, amenities } = req.body;

        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée.' });
        }
        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à modifier cette annonce.' });
        }

        let imageUrls = housing.images; // Garder les anciennes images par défaut

        // Si de nouveaux fichiers sont uploadés, on remplace (ou ajoute)
        if (req.files && req.files.length > 0) {
            imageUrls = []; // Vider ou gérer la suppression sur Cloudinary si nécessaire.
            for (const file of req.files) {
                const b64 = Buffer.from(file.buffer).toString("base64");
                let dataURI = "data:" + file.mimetype + ";base64," + b64;
                const result = await cloudinary.uploader.upload(dataURI);
                imageUrls.push(result.secure_url);
            }
        }

        // Mise à jour des données
        housing.title = title || housing.title;
        housing.description = description || housing.description;
        housing.price = Number(price) || housing.price;
        housing.location = {
            address: address || housing.location.address,
            city: city || housing.location.city,
            zipCode: zipCode || housing.location.zipCode
        };
        housing.type = type || housing.type;
        housing.amenities = amenities ? amenities.split(',').map(a => a.trim()) : housing.amenities;
        housing.images = imageUrls;

        const updatedHousing = await housing.save();
        res.status(200).json({ message: 'Annonce mise à jour avec succès.', housing: updatedHousing });

    } catch (error) {
        console.error("Erreur lors de la modification de l'annonce:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la modification de l\'annonce.' });
    }
});

// DELETE /api/user/housing/:id : Supprimer une annonce (Propriétaire uniquement)
app.delete('/api/user/housing/:id', authMiddleware, async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé.' });
    }
    try {
        const housingId = req.params.id;
        const userId = req.userData.userId;

        const housing = await Housing.findOneAndDelete({ _id: housingId, landlord: userId });

        if (!housing) {
            return res.status(404).json({ message: 'Annonce non trouvée ou vous n\'êtes pas le propriétaire.' });
        }

        // Supprimer également les bookings associés pour le nettoyage
        await Booking.deleteMany({ housing: housingId });

        res.status(200).json({ message: 'Annonce et réservations associées supprimées avec succès.' });
    } catch (error) {
        console.error("Erreur lors de la suppression de l'annonce:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'annonce.' });
    }
});


// ====================================================================
// 5. ROUTES DE RÉSERVATION ET PAIEMENT (Booking & Stripe)
// ====================================================================

// POST /api/booking/create-checkout-session : Créer une session Stripe
app.post('/api/booking/create-checkout-session', authMiddleware, async (req, res) => {
    if (req.userData.userRole !== 'tenant') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les locataires peuvent faire des réservations.' });
    }

    try {
        const { housingId, startDate, endDate, totalPrice } = req.body;
        const tenantId = req.userData.userId;

        const housing = await Housing.findById(housingId);
        if (!housing || housing.landlord.toString() === tenantId) {
            return res.status(400).json({ message: 'Réservation impossible (logement introuvable ou vous êtes le propriétaire).' });
        }

        // Créer une réservation *pending* dans la DB
        const newBooking = new Booking({
            housing: housingId,
            tenant: tenantId,
            landlord: housing.landlord,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalPrice: totalPrice,
            status: 'pending'
        });
        await newBooking.save();

        // Créer la session de paiement Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: housing.title,
                        description: `Réservation du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`
                    },
                    unit_amount: Math.round(totalPrice * 100), // Stripe utilise des centimes
                },
                quantity: 1,
            }],
            mode: 'payment',
            // En cas de succès, redirige vers la page de succès avec l'ID de la réservation
            success_url: `${CLIENT_URL}/success?booking_id=${newBooking._id}`,
            // En cas d'annulation, redirige vers la page de détails du logement
            cancel_url: `${CLIENT_URL}/housing/${housingId}`,
            // Passer l'ID de la réservation dans les métadonnées de la session
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: tenantId,
            },
        });

        res.status(200).json({ id: session.id, url: session.url, bookingId: newBooking._id });

    } catch (error) {
        console.error("Erreur Stripe/Booking:", error);
        res.status(500).json({ message: error.message || 'Erreur serveur lors de la création de la session de paiement.' });
    }
});

// GET /api/booking/payment-success : Confirmation du paiement Stripe
app.get('/api/booking/payment-success', async (req, res) => {
    try {
        const { booking_id, session_id } = req.query;

        // On utilise l'ID de la session pour la validation, si possible
        if (session_id) {
            const session = await stripe.checkout.sessions.retrieve(session_id);
            const bookingIdFromSession = session.metadata.bookingId;

            if (session.payment_status === 'paid' && bookingIdFromSession) {
                // Mettre à jour la réservation comme 'confirmed'
                const booking = await Booking.findByIdAndUpdate(
                    bookingIdFromSession,
                    { status: 'confirmed', stripeSessionId: session_id },
                    { new: true }
                ).populate('tenant', 'name email').populate('landlord', 'name email');

                if (booking) {
                    // Créer une notification pour le propriétaire
                    const notification = new Notification({
                        recipient: booking.landlord,
                        sender: booking.tenant,
                        type: 'booking_confirmed',
                        content: `Nouvelle réservation confirmée pour votre annonce: ${booking.housing.title} par ${booking.tenant.name}.`,
                        link: `/dashboard`,
                        relatedModel: 'Booking',
                        relatedId: booking._id
                    });
                    await notification.save();

                    return res.status(200).json({ message: 'Paiement réussi et réservation confirmée !', booking });
                }
            }
        }
        
        // Si session_id n'est pas utilisé ou échec de validation, on utilise l'ID de la réservation
        if (booking_id) {
            // Mettre à jour la réservation comme 'confirmed' (utile si le webhook n'a pas été implémenté)
            const booking = await Booking.findByIdAndUpdate(
                booking_id,
                { status: 'confirmed' },
                { new: true }
            );
            if (booking) {
                return res.status(200).json({ message: 'Paiement réussi et réservation confirmée !', booking });
            }
        }


        // Si aucune des conditions n'est remplie
        return res.status(400).json({ message: 'Paiement non confirmé ou réservation introuvable.' });

    } catch (error) {
        console.error("Erreur de confirmation de paiement:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la vérification du paiement.' });
    }
});


// GET /api/bookings : Récupérer toutes les réservations de l'utilisateur (Locataire/Propriétaire)
app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const userRole = req.userData.userRole;

        let bookings;

        if (userRole === 'landlord') {
            // Propriétaire : toutes les réservations de ses logements
            bookings = await Booking.find({ landlord: userId })
                .populate('housing', 'title images')
                .populate('tenant', 'name email')
                .sort({ createdAt: -1 });
        } else {
            // Locataire : toutes ses réservations
            bookings = await Booking.find({ tenant: userId })
                .populate('housing', 'title images')
                .populate('landlord', 'name email')
                .sort({ createdAt: -1 });
        }

        res.status(200).json({ bookings });
    } catch (error) {
        console.error("Erreur sur GET /api/bookings :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des réservations.' });
    }
});

// PUT /api/bookings/:id/status : Mettre à jour le statut d'une réservation (Propriétaire uniquement)
app.put('/api/bookings/:id/status', authMiddleware, async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seuls les propriétaires peuvent gérer les statuts.' });
    }
    try {
        const bookingId = req.params.id;
        const { status } = req.body; // 'confirmed', 'cancelled', 'completed'

        const booking = await Booking.findById(bookingId);
        if (!booking || booking.landlord.toString() !== req.userData.userId) {
            return res.status(404).json({ message: 'Réservation non trouvée ou accès refusé.' });
        }

        if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
            return res.status(400).json({ message: 'Statut de réservation invalide.' });
        }

        booking.status = status;
        await booking.save();

        // Créer une notification pour le locataire
        const notification = new Notification({
            recipient: booking.tenant,
            sender: req.userData.userId,
            type: 'booking_status_update',
            content: `Le statut de votre réservation pour ${booking.housing.title} est maintenant: ${status.toUpperCase()}.`,
            link: `/dashboard`,
            relatedModel: 'Booking',
            relatedId: booking._id
        });
        await notification.save();

        res.status(200).json({ message: `Statut mis à jour à ${status}`, booking });
    } catch (error) {
        console.error("Erreur de mise à jour du statut:", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 6. ROUTES DOCUMENTS DE PROFIL (ProfileDoc)
// ====================================================================

// POST /api/user/documents : Télécharger un document de profil (Locataire/Propriétaire)
app.post('/api/user/documents', authMiddleware, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier fourni.' });
        }
        const { docType } = req.body;
        if (!docType) {
            return res.status(400).json({ message: 'Le type de document est requis.' });
        }

        const userId = req.userData.userId;

        // Upload du fichier sur Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
        const result = await cloudinary.uploader.upload(dataURI, {
            folder: `profile_docs/${userId}`,
            resource_type: "auto" // Gère les PDFs, images, etc.
        });

        // Supprimer l'ancien document du même type s'il existe
        await ProfileDoc.findOneAndDelete({ user: userId, docType: docType });

        // Créer une nouvelle entrée dans la DB
        const newDoc = new ProfileDoc({
            user: userId,
            docType: docType,
            url: result.secure_url,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype
        });
        await newDoc.save();

        res.status(201).json({ message: 'Document téléchargé et enregistré avec succès.', document: newDoc });

    } catch (error) {
        console.error("Erreur lors de l'upload du document:", error);
        res.status(500).json({ message: 'Erreur serveur lors du téléchargement du document.' });
    }
});

// GET /api/user/documents : Récupérer la liste des documents de l'utilisateur
app.get('/api/user/documents', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const documents = await ProfileDoc.find({ user: userId });
        res.status(200).json({ documents });
    } catch (error) {
        console.error("Erreur sur GET /api/user/documents :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des documents.' });
    }
});


// ====================================================================
// 7. ROUTES NOTIFICATIONS
// ====================================================================

// GET /api/notifications : Récupérer les notifications de l'utilisateur
app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const notifications = await Notification.find({ recipient: userId })
            .populate('sender', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ notifications });
    } catch (error) {
        console.error("Erreur sur GET /api/notifications :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des notifications.' });
    }
});

// PUT /api/notifications/:id/read : Marquer une notification comme lue
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const userId = req.userData.userId;

        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: userId }, // Sécurité: seul le destinataire peut marquer comme lu
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification non trouvée ou accès refusé.' });
        }

        res.status(200).json({ message: 'Notification marquée comme lue.', notification });
    } catch (error) {
        console.error("Erreur de mise à jour de la notification:", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 8. ROUTES MESSAGERIE/CONVERSATIONS
// ====================================================================

// GET /api/conversations : Récupérer la liste des conversations de l'utilisateur
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;

        // Trouver toutes les conversations où l'utilisateur est un participant
        const conversations = await Conversation.find({ participants: userId })
            .populate('participants', 'name email') // Pour afficher le nom de l'interlocuteur
            .populate('housing', 'title') // Pour identifier le logement
            .populate({
                path: 'lastMessage',
                select: 'content sender createdAt' // Récupère le contenu, l'expéditeur et la date du dernier message
            })
            .sort({ updatedAt: -1 }); // Trié par la dernière activité

        res.status(200).json({ conversations });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des conversations.' });
    }
});

// POST /api/conversations/start : Créer ou trouver une conversation
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const senderId = req.userData.userId;
        const { recipientId, housingId } = req.body;

        if (senderId === recipientId) {
            return res.status(400).json({ message: 'Vous ne pouvez pas vous envoyer un message à vous-même.' });
        }

        // Tenter de trouver une conversation existante entre les deux participants pour ce logement
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
            housing: housingId
        });

        if (!conversation) {
            // Si aucune conversation n'existe, on en crée une nouvelle
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId
            });
            await conversation.save();
        }

        res.status(200).json({ conversationId: conversation._id });
    } catch (error) {
        console.error("Erreur sur POST /api/conversations/start :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de la conversation.' });
    }
});

// GET /api/conversations/:id/messages : Récupérer les messages d'une conversation
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userData.userId;

        const conversation = await Conversation.findById(id);
        if (!conversation || !conversation.participants.map(p => p.toString()).includes(userId)) {
            return res.status(403).json({ message: 'Accès refusé. Vous ne faites pas partie de cette conversation.' });
        }

        // Récupérer les messages, triés du plus ancien au plus récent
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name')
            .sort({ createdAt: 1 });

        res.status(200).json({ messages });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});


// ----------------------------------------------------
// FIN DES ROUTES API
// ----------------------------------------------------


// ====================================================================
// 9. GESTION DES WEBSOCKETS (Messagerie en Temps Réel)
// ====================================================================

// Création du serveur HTTP
const server = http.createServer(app);

// Création du serveur WebSocket (wss) attaché au serveur HTTP
const wss = new WebSocket.Server({ server });

// Map pour associer userId et l'instance WebSocket
const userWsMap = new Map();

wss.on('connection', (ws, req) => {
    console.log('Nouveau client WebSocket connecté.');
    
    // Le token peut être passé via les headers de la requête de connexion WS
    // L'implémentation complète nécessiterait de parser le token ici (req.url ou headers).
    // Pour simplifier l'exemple, l'ID utilisateur est souvent passé au moment de la connexion côté client
    // ou récupéré via le token de la requête initiale.

    let userId = null; // ID de l'utilisateur connecté via cette WebSocket

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());

            // 1. Authentification/Enregistrement de l'utilisateur
            if (data.type === 'AUTH' && data.token) {
                const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                userId = decoded.userId;
                userWsMap.set(userId, ws); // Enregistre la WS avec l'ID utilisateur
                console.log(`Utilisateur authentifié via WebSocket: ${userId}`);
                ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', userId }));
                return;
            }

            // Si l'utilisateur n'est pas authentifié pour le message
            if (!userId) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Authentification requise.' }));
                return;
            }

            // 2. Traitement d'un nouveau message
            if (data.type === 'NEW_MESSAGE') {
                const { conversationId, content, recipientId } = data.payload;
                
                if (!conversationId || !content || !recipientId) {
                     return ws.send(JSON.stringify({ type: 'ERROR', message: 'Données de message incomplètes.' }));
                }

                // Sauvegarder le message
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId,
                    content: content
                });
                await newMessage.save();
                
                // Mettre à jour la conversation avec le dernier message et la date
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: newMessage._id,
                    updatedAt: new Date()
                });

                // Construire l'objet à envoyer aux clients
                const messageToSend = {
                    type: 'MESSAGE_RECEIVED',
                    payload: {
                        _id: newMessage._id,
                        content: newMessage.content,
                        createdAt: newMessage.createdAt,
                        conversation: conversationId,
                        sender: {
                            _id: userId,
                            name: (await User.findById(userId, 'name')).name // Récupère le nom
                        }
                    }
                };
                
                // Envoyer au destinataire (conversion en String pour la map)
                const recipientWs = userWsMap.get(recipientId.toString());
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

    // 3. Déconnexion
    ws.on('close', () => {
        if (userId) {
            // Supprimer l'utilisateur de la map s'il était authentifié
            userWsMap.delete(userId); 
            console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
        }
    });
});


// ====================================================================
// 10. DÉMARRAGE DU SERVEUR
// ====================================================================

// Route pour la documentation de l'API (Swagger)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Définition de la route de test (vérification simple)
app.get('/', (req, res) => {
    res.send('Bienvenue sur l\'API de G-House ! La connexion à la DB est établie.');
});

// Le serveur (HTTP + WebSocket) démarre et écoute sur le port défini
server.listen(PORT, () => {
    console.log(`Le serveur de G-House est en cours d'exécution sur le port ${PORT}`);
});