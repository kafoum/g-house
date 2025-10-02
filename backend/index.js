// Fichier : backend/index.js

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================
// 1. IMPORTS DES MODULES
// ====================================================================
const authMiddleware = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); 
const cors = require('cors'); 
const moment = require('moment');

// Modules WebSocket
const http = require('http');
const WebSocket = require('ws');

// ====================================================================
// 2. INITIALISATION DES SERVICES EXTERNES
// ====================================================================

// INITIALISATION DE STRIPE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration Multer pour les fichiers en mémoire (Buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// ====================================================================
// 3. IMPORTS DES MODÈLES MONGOOSE 
// ====================================================================
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// ====================================================================
// 4. CONFIGURATION DE L'APPLICATION ET DE LA DB
// ====================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch((error) => console.error('Erreur de connexion à MongoDB :', error));

// Création du serveur HTTP (nécessaire pour le WebSocket)
const server = http.createServer(app);

// Middleware CORS
app.use(cors({
    origin: process.env.VERCEL_FRONTEND_URL || 'https://g-house.vercel.app', // Remplacez par votre URL Vercel en prod
    credentials: true,
}));

// Middleware pour analyser le corps des requêtes JSON (doit être AVANT les routes)
// Note: Stripe webhook doit être AVANT body-parser (voir ci-dessous)


// Middleware Express pour parser le JSON et les données de formulaire
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// ====================================================================
// 5. FONCTIONS UTILITAIRES POUR STRIPE/BOOKING
// ====================================================================

/**
 * Calcule le prix total exact.
 * @param {number} pricePerMonth - Le prix mensuel de l'annonce.
 * @param {Date} startDate - Date de début de la réservation.
 * @param {Date} endDate - Date de fin de la réservation.
 * @returns {number} Le prix total calculé.
 */
function calculateFinalPrice(pricePerMonth, startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    
    if (!start.isValid() || !end.isValid() || end.isSameOrBefore(start)) {
        return 0;
    }

    // Calcul du nombre de jours exacts (exclusif du jour de fin)
    const durationDays = end.diff(start, 'days');
    
    if (durationDays <= 0) return 0;

    // Prix journalier basé sur 30 jours (approximation standard)
    const pricePerDay = pricePerMonth / 30.0;
    
    // Prix total arrondi à deux décimales
    const totalPrice = (pricePerDay * durationDays);
    
    // Stripe travaille en centimes, on arrondit au centime supérieur ou inférieur
    // Pour cet exemple, nous allons simplement arrondir pour éviter les erreurs de flottants
    return Math.round(totalPrice * 100) / 100; 
}


// ====================================================================
// 6. ROUTES AUTHENTIFICATION
// ====================================================================

// Route d'inscription
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'L\'utilisateur avec cet email existe déjà.' });
        }

        const newUser = new User({ name, email, password, role: role || 'tenant' });
        await newUser.save();

        res.status(201).json({ message: 'Inscription réussie ! Vous pouvez vous connecter.', user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
    } catch (error) {
        console.error("Erreur sur /api/register :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route de connexion
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // Création du token JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.status(200).json({ 
            token, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role 
            } 
        });
    } catch (error) {
        console.error("Erreur sur /api/login :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 7. ROUTES ANNONCES (HOUSING)
// ====================================================================

// Route pour lister TOUS les logements (pour la page d'accueil)
app.get('/api/housing', async (req, res) => {
    try {
        // ✅ CORRECTION CLÉ : Filtre par status 'active' pour la page publique
        // Peupler le champ 'landlord' pour l'affichage du nom du propriétaire
        const housing = await Housing.find({ status: 'active' }).populate('landlord', 'name');
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route pour obtenir les logements du propriétaire connecté (Dashboard)
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    const userId = req.userData.userId;
    try {
        // ✅ FILTRE DU DASHBOARD : ne filtre que par propriétaire, PAS par statut
        const housing = await Housing.find({ landlord: userId }).populate('landlord', 'name email');
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/user/housing :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route pour obtenir les détails d'un logement
app.get('/api/housing/:id', async (req, res) => {
    try {
        const housing = await Housing.findById(req.params.id)
            .populate('landlord', 'name email'); // Récupère le propriétaire

        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        res.status(200).json({ housing });
    } catch (error) {
        console.error("Erreur sur GET /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// Route de CRÉATION de logement
app.post('/api/housing', authMiddleware, upload.array('images', 10), async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul le propriétaire peut créer une annonce.' });
    }

    try {
        // Assurez-vous que les données JSON sont bien dans le champ 'data' de FormData
        const data = req.body.data;
        if (!data) {
            return res.status(400).json({ message: 'Données de formulaire manquantes.' });
        }

        let housingData;
        try {
            // Parser les données JSON (titre, description, prix, etc.)
            housingData = JSON.parse(data); 
        } catch (e) {
            return res.status(400).json({ message: 'Format des données invalide.' });
        }
        
        housingData.landlord = req.userData.userId; 
        
        // 🚨 REMARQUE CLÉ : Le statut est géré par la valeur 'default: active' dans models/Housing.js. 
        // PAS besoin de définir explicitement housingData.status = 'active';

        // Gérer l'upload des images (si des fichiers ont été attachés)
        const uploadedImages = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                // Utiliser le buffer du fichier pour l'upload
                const result = await cloudinary.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    { folder: 'g-house/housing_images' } // Organiser les images dans un dossier
                );
                uploadedImages.push(result.secure_url);
            }
        }
        
        housingData.images = uploadedImages;
        
        // Convertir les commodités (amenities) de string à Array si nécessaire
        if (typeof housingData.amenities === 'string') {
             housingData.amenities = housingData.amenities.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }

        const newHousing = new Housing(housingData);
        await newHousing.save();

        res.status(201).json({ message: 'Annonce créée avec succès !', housing: newHousing });
    } catch (error) {
        console.error("Erreur sur POST /api/housing :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// Route de MODIFICATION de logement
app.put('/api/housing/:id', authMiddleware, upload.array('images', 10), async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul le propriétaire peut modifier une annonce.' });
    }

    try {
        const housingId = req.params.id;
        const userId = req.userData.userId;

        // 1. Trouver le logement
        let housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }
        
        // 2. Vérifier la propriété
        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }

        // 3. Parser les données de mise à jour
        const data = req.body.data;
        if (!data) {
            return res.status(400).json({ message: 'Données de formulaire manquantes.' });
        }
        
        let updateData;
        try {
            updateData = JSON.parse(data); 
        } catch (e) {
            return res.status(400).json({ message: 'Format des données invalide.' });
        }

        // 4. Gérer l'upload des images
        const newImages = [...housing.images]; // Conserver les anciennes images
        
        if (req.files && req.files.length > 0) {
            // NOTE: Dans cette version, nous supposons que les nouvelles images REMPLACENT les anciennes. 
            // La logique plus complexe de gestion d'ajout/suppression doit être implémentée côté client/serveur.
            
            // On peut choisir de vider le tableau et de tout uploader à nouveau, ou de n'ajouter que les nouvelles.
            // Pour simplifier, nous ajoutons les nouvelles images (le front doit vider si nécessaire)
            
            // Pour l'édition, le front envoie souvent un array d'URLs existantes + de nouveaux fichiers.
            // Ici, nous faisons simple : nous n'ajoutons que les nouveaux fichiers.
            
            for (const file of req.files) {
                const result = await cloudinary.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    { folder: 'g-house/housing_images' }
                );
                newImages.push(result.secure_url);
            }
            updateData.images = newImages; // Met à jour la liste des images
        }
        
        // Convertir les commodités (amenities) de string à Array si nécessaire
        if (updateData.amenities && typeof updateData.amenities === 'string') {
             updateData.amenities = updateData.amenities.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }

        // 5. Mettre à jour le logement
        const updatedHousing = await Housing.findByIdAndUpdate(
            housingId, 
            { $set: updateData }, 
            { new: true, runValidators: true } // new: true retourne le document mis à jour
        );

        res.status(200).json({ message: 'Annonce mise à jour avec succès !', housing: updatedHousing });
    } catch (error) {
        console.error("Erreur sur PUT /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// Route de SUPPRESSION de logement
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul le propriétaire peut supprimer une annonce.' });
    }
    
    try {
        const housingId = req.params.id;
        const userId = req.userData.userId;

        const housing = await Housing.findById(housingId);
        if (!housing) {
            return res.status(404).json({ message: 'Logement non trouvé.' });
        }

        // Vérifier la propriété
        if (housing.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette annonce.' });
        }
        
        // Supprimer le logement
        await Housing.findByIdAndDelete(housingId);
        
        // Supprimer les réservations associées (optionnel, mais recommandé)
        await Booking.deleteMany({ housing: housingId });

        // NOTE: La suppression des images sur Cloudinary est plus complexe et est omise ici pour la simplicité.

        res.status(200).json({ message: 'Annonce supprimée avec succès.' });
    } catch (error) {
        console.error("Erreur sur DELETE /api/housing/:id :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 8. ROUTES RÉSERVATIONS (BOOKING) ET PAIEMENT (STRIPE)
// ====================================================================

// Route pour démarrer le processus de réservation (Stripe Checkout Session)
app.post('/api/booking/create-checkout-session', authMiddleware, async (req, res) => {
    if (req.userData.userRole !== 'tenant') {
        return res.status(403).json({ message: 'Accès refusé. Seul le locataire peut réserver.' });
    }

    try {
        const { housingId, startDate, endDate } = req.body;
        const tenantId = req.userData.userId;

        // 1. Vérifier le logement
        const housing = await Housing.findById(housingId);
        if (!housing || housing.status !== 'active') {
            return res.status(404).json({ message: 'Logement non disponible ou non trouvé.' });
        }
        
        // 2. Calculer le prix final côté serveur
        const finalPrice = calculateFinalPrice(housing.price, startDate, endDate);
        const priceInCents = Math.round(finalPrice * 100);

        if (priceInCents <= 0) {
             return res.status(400).json({ message: 'Les dates de réservation sont invalides.' });
        }
        
        // 3. Créer une intention de réservation temporaire
        const newBooking = new Booking({
            housing: housingId,
            tenant: tenantId,
            landlord: housing.landlord,
            startDate: startDate,
            endDate: endDate,
            totalPrice: finalPrice,
            status: 'pending' // En attente de paiement
        });
        await newBooking.save();

        // 4. Créer la session de paiement Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: housing.title,
                            description: `Réservation du ${moment(startDate).format('DD/MM/YYYY')} au ${moment(endDate).format('DD/MM/YYYY')}`,
                        },
                        unit_amount: priceInCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            // URL de redirection après succès ou échec (doit correspondre au front)
            success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${newBooking._id}`,
            cancel_url: `${process.env.FRONTEND_URL}/housing/${housingId}?cancelled=true`,
            metadata: {
                bookingId: newBooking._id.toString(),
                tenantId: tenantId.toString(),
            },
        });

        res.status(200).json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error("Erreur sur /api/booking/create-checkout-session :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la création de la session de paiement.' });
    }
});

// Route de succès de paiement (gérée par le front pour finaliser la réservation)
app.get('/api/booking/payment-success', authMiddleware, async (req, res) => {
    try {
        const { session_id, booking_id } = req.query;

        // 1. Vérifier la session Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status === 'paid' && session.metadata.bookingId === booking_id) {
            // 2. Mettre à jour la réservation
            const updatedBooking = await Booking.findByIdAndUpdate(
                booking_id,
                { $set: { status: 'confirmed', stripeSessionId: session_id } },
                { new: true }
            );
            
            if (!updatedBooking) {
                return res.status(404).json({ message: 'Réservation non trouvée.' });
            }

            // 3. Créer une notification pour le propriétaire
            const notification = new Notification({
                user: updatedBooking.landlord,
                type: 'booking_confirmed',
                message: `Une nouvelle réservation a été confirmée pour votre logement : ${updatedBooking.housing.title}`,
                housing: updatedBooking.housing,
                booking: updatedBooking._id
            });
            await notification.save();
            
            res.status(200).json({ message: 'Paiement réussi et réservation confirmée !', booking: updatedBooking });
        } else {
            res.status(400).json({ message: 'Statut de paiement invalide ou session mismatch.' });
        }
    } catch (error) {
        console.error("Erreur sur /api/booking/payment-success :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la confirmation de la réservation.' });
    }
});


// Route pour obtenir toutes les réservations (pour le Dashboard du propriétaire)
app.get('/api/bookings', authMiddleware, async (req, res) => {
    // Peut être appelé par le locataire pour voir ses réservations ou par le propriétaire pour voir celles sur ses logements.
    const userId = req.userData.userId;
    const userRole = req.userData.userRole;

    try {
        let query = {};
        if (userRole === 'landlord') {
            query.landlord = userId;
        } else {
            query.tenant = userId;
        }

        const bookings = await Booking.find(query)
            .populate('housing', 'title images price') // Logement lié
            .populate('tenant', 'name email') // Locataire lié
            .populate('landlord', 'name email') // Propriétaire lié
            .sort({ createdAt: -1 });

        res.status(200).json({ bookings });
    } catch (error) {
        console.error("Erreur sur GET /api/bookings :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// Route pour mettre à jour le statut d'une réservation (propriétaire)
app.put('/api/bookings/:id/status', authMiddleware, async (req, res) => {
    if (req.userData.userRole !== 'landlord') {
        return res.status(403).json({ message: 'Accès refusé. Seul le propriétaire peut modifier le statut.' });
    }

    try {
        const bookingId = req.params.id;
        const newStatus = req.body.status;
        const userId = req.userData.userId;

        // Vérification du statut valide
        const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ message: 'Statut de réservation invalide.' });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        // Vérifier si le propriétaire est bien celui de la réservation
        if (booking.landlord.toString() !== userId) {
            return res.status(403).json({ message: 'Accès refusé. Vous n\'êtes pas le propriétaire de cette réservation.' });
        }

        // Mise à jour du statut
        booking.status = newStatus;
        await booking.save();
        
        // Notification pour le locataire (si nécessaire)
        // ... (Logique de notification)
        
        res.status(200).json({ message: `Statut de réservation mis à jour à ${newStatus}.`, booking });

    } catch (error) {
        console.error("Erreur sur PUT /api/bookings/:id/status :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 9. ROUTES MESSAGERIE (CONVERSATIONS ET MESSAGES)
// ====================================================================

// Route pour obtenir la liste des conversations de l'utilisateur
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;

        // Cherche les conversations où l'utilisateur est un participant
        const conversations = await Conversation.find({ participants: userId })
            .populate('participants', 'name email') 
            .populate('housing', 'title') // Logement lié
            .sort({ updatedAt: -1 }); 

        res.status(200).json({ conversations });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des conversations.' });
    }
});

// Route pour démarrer une conversation (ou récupérer une existante)
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const { recipientId, housingId } = req.body;
        const senderId = req.userData.userId;
        
        if (senderId === recipientId) {
            return res.status(400).json({ message: 'Vous ne pouvez pas démarrer une conversation avec vous-même.' });
        }

        // 1. Chercher si une conversation existe déjà pour ce couple et ce logement
        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, recipientId] },
            housing: housingId
        });

        // 2. Si non, créer une nouvelle conversation
        if (!conversation) {
            conversation = new Conversation({
                participants: [senderId, recipientId],
                housing: housingId,
            });
            await conversation.save();
        }

        // 3. Charger la conversation avec les données complètes
        conversation = await conversation.populate('participants', 'name email').populate('housing', 'title');

        res.status(200).json({ conversation });
    } catch (error) {
        console.error("Erreur sur POST /api/conversations/start :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
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
        
        const messages = await Message.find({ conversation: id })
            .populate('sender', 'name')
            .sort({ createdAt: 1 }); // Ordre chronologique

        res.status(200).json({ messages });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Une erreur est survenue lors de la récupération des messages.' });
    }
});


// ====================================================================
// 10. ROUTES DOCUMENTS DE PROFIL
// ====================================================================

// Route pour télécharger un document de profil
app.post('/api/user/documents', authMiddleware, upload.single('file'), async (req, res) => {
    // NOTE: Seul le locataire peut généralement uploader des documents de profil
    if (req.userData.userRole !== 'tenant') {
        // Optionnel : permettre aussi au propriétaire d'uploader
        // return res.status(403).json({ message: 'Accès refusé. Seul le locataire peut uploader des documents.' });
    }

    try {
        const { docType } = req.body; 
        const userId = req.userData.userId;
        const file = req.file;

        if (!file || !docType) {
            return res.status(400).json({ message: 'Fichier ou type de document manquant.' });
        }

        // Upload vers Cloudinary
        const result = await cloudinary.uploader.upload(
            `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
            { 
                folder: `g-house/user_docs/${userId}`, 
                resource_type: 'raw', // Pour les PDF/autres
                public_id: docType // Utiliser le type comme nom
            }
        );

        // Sauvegarder l'info dans la DB (on remplace s'il existe déjà pour ce type)
        const newDoc = await ProfileDoc.findOneAndUpdate(
            { user: userId, docType: docType },
            { 
                url: result.secure_url, 
                fileName: file.originalname,
                mimetype: file.mimetype,
                uploadedAt: Date.now()
            },
            { new: true, upsert: true } // Crée si non trouvé
        );

        res.status(200).json({ message: `Document '${docType}' téléchargé avec succès.`, document: newDoc });
    } catch (error) {
        console.error("Erreur sur POST /api/user/documents :", error);
        res.status(500).json({ message: 'Erreur serveur lors du téléchargement du document.' });
    }
});

// Route pour obtenir la liste des documents de profil
app.get('/api/user/documents', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        
        // Le propriétaire doit pouvoir voir les documents des locataires... 
        // (Logique omise ici pour ne voir que les siens)
        const documents = await ProfileDoc.find({ user: userId });

        res.status(200).json({ documents });
    } catch (error) {
        console.error("Erreur sur GET /api/user/documents :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 11. GESTION DES NOTIFICATIONS
// ====================================================================

// Route pour récupérer les notifications de l'utilisateur
app.get('/api/notifications', authMiddleware, async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.userData.userId })
            .populate('housing', 'title')
            .sort({ createdAt: -1 });

        res.status(200).json({ notifications });
    } catch (error) {
        console.error("Erreur sur GET /api/notifications :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});

// Route pour marquer une notification comme lue
app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.userData.userId },
            { $set: { isRead: true } },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification non trouvée ou accès refusé.' });
        }

        res.status(200).json({ message: 'Notification marquée comme lue.', notification });
    } catch (error) {
        console.error("Erreur sur PUT /api/notifications/:id/read :", error);
        res.status(500).json({ message: 'Erreur serveur.' });
    }
});


// ====================================================================
// 12. GESTION DES WEBSOCKETS (CHAT)
// ====================================================================

const wss = new WebSocket.Server({ server });
const userWsMap = new Map(); // Map pour associer userId et l'instance WebSocket

wss.on('connection', (ws, req) => {
    let userId = null;

    // 1. Authentification lors de la connexion
    // Le front doit envoyer un message 'AUTH' immédiatement avec le token
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'AUTH' && data.token) {
                // Vérifier le token JWT
                const decodedToken = jwt.verify(data.token, process.env.JWT_SECRET);
                userId = decodedToken.userId;
                
                // Stocker l'utilisateur dans la map
                userWsMap.set(userId, ws);
                console.log(`Utilisateur connecté via WebSocket: ${userId}`);

                ws.send(JSON.stringify({ type: 'STATUS', status: 'connected', userId: userId }));
                return;
            }

            // 2. Traitement du message (si l'utilisateur est authentifié)
            if (data.type === 'MESSAGE' && userId) {
                const { conversationId, content } = data;

                if (!conversationId || !content) return;

                // Vérifier que l'utilisateur fait partie de la conversation
                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.includes(userId)) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Accès à la conversation refusé.' }));
                    return;
                }

                // 3. Sauvegarder le message
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId,
                    content: content
                });
                await newMessage.save();

                // 4. Mettre à jour la conversation (lastMessage et updatedAt)
                conversation.lastMessage = newMessage._id;
                conversation.updatedAt = Date.now();
                await conversation.save();

                // 5. Relayer le message aux participants
                const recipientId = conversation.participants.find(p => p.toString() !== userId);
                
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    message: {
                        _id: newMessage._id,
                        content: newMessage.content,
                        sender: { _id: userId, name: req.userData?.userName || 'Moi' }, // Utilisez le nom si disponible
                        createdAt: newMessage.createdAt,
                        conversation: conversationId,
                    }
                };
                
                // Envoyer au destinataire
                const recipientWs = userWsMap.get(recipientId.toString());
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                    recipientWs.send(JSON.stringify(messageToSend));
                }

                // Envoyer à l'expéditeur (pour la confirmation)
                ws.send(JSON.stringify(messageToSend)); 
            }

        } catch (error) {
            // Si le token est invalide ou autre erreur
            console.error('Erreur de traitement de message WebSocket:', error);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Erreur serveur ou authentification invalide.' }));
            }
        }
    });

    // 6. Déconnexion
    ws.on('close', () => {
        if (userId) {
            userWsMap.delete(userId); // Supprimer l'utilisateur de la map
            console.log(`Utilisateur déconnecté via WebSocket: ${userId}`);
        }
    });
});


// ====================================================================
// 13. ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
// ====================================================================

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
