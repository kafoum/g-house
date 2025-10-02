// Fichier : backend/index.js

// Charge les variables d'environnement depuis le fichier .env
require('dotenv').config();

// ====================================================================
// 1. IMPORTS DES MODULES ET INITIALISATION
// ====================================================================
const authMiddleware = require('./middleware/auth'); 
const jwt = require('jsonwebtoken');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const nodemailer = require('nodemailer'); // Pour l'envoi d'e-mails
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); // Assurez-vous d'avoir ce fichier
const cors = require('cors'); 

// Modules WebSocket
const http = require('http');
const WebSocket = require('ws');

// INITIALISATION DE STRIPE
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration Multer pour la gestion des fichiers en mémoire
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Imports des modèles Mongoose
const User = require('./models/User');
const Housing = require('./models/Housing');
const Booking = require('./models/Booking');
const ProfileDoc = require('./models/ProfileDoc');
const Notification = require('./models/Notification');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');


// ====================================================================
// 2. CONFIGURATION ET CONNEXION À LA BASE DE DONNÉES
// ====================================================================
const app = express();
const server = http.createServer(app); // Utiliser le serveur HTTP pour Express et WebSocket
const PORT = process.env.PORT || 10000;
const DB_URI = process.env.MONGO_URI;

// Middleware Express de base
app.use(cors({
    // Permet à votre front-end Vercel d'accéder à l'API
    origin: process.env.FRONTEND_URL || '*', 
    credentials: true,
}));
app.use(express.json()); // Pour parser le JSON
app.use(express.urlencoded({ extended: true })); // Pour les données d'URL encodées


// Connexion à MongoDB
mongoose.connect(DB_URI)
    .then(() => console.log('Connexion à MongoDB réussie !'))
    .catch(err => console.error('Erreur de connexion à MongoDB :', err));


// ====================================================================
// 3. ROUTES AUTHENTIFICATION (USER)
// ====================================================================

// Inscription
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // Validation basique
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: "Tous les champs sont requis." });
        }
        
        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "Cet email est déjà utilisé." });
        }

        const newUser = new User({ name, email, password, role });
        await newUser.save();
        
        res.status(201).json({ message: "Inscription réussie. Vous pouvez maintenant vous connecter." });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'inscription.' });
    }
});

// Connexion
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // bcryptjs gère la comparaison des mots de passe hachés
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // Création du token JWT
        const token = jwt.sign(
            { userId: user._id.toString(), role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' } // Token expire après 24 heures
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
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
    }
});

// ====================================================================
// 4. ROUTES LOGEMENTS (HOUSING)
// ====================================================================

// Route 4.1 : Récupérer tous les logements (liste pour locataires) : GET /api/housing
app.get('/api/housing', async (req, res) => {
    try {
        // Optionnel : ajouter des filtres (city, price_min, price_max, etc.)
        const { city } = req.query;
        let filter = {};
        if (city) {
            // Recherche insensible à la casse et partielle sur la ville
            filter['location.city'] = { $regex: city, $options: 'i' };
        }
        
        const housing = await Housing.find(filter).populate('landlord', 'name email');
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des logements.' });
    }
});


// Route 4.2 : Créer un nouveau logement : POST /api/housing (CORRECTION DU BUG 500)
app.post('/api/housing', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: "Accès refusé. Seul le propriétaire peut créer un logement." });
        }

        // 🔑 CORRECTION CRITIQUE : Récupérer explicitement chaque champ de localisation,
        // car FormData envoie tout comme des chaînes, provoquant l'erreur de validation.
        const { 
            title, 
            description, 
            price, 
            type, 
            amenities,
            address, // Récupération directe
            city,    // Récupération directe
            zipCode  // Récupération directe
        } = req.body;
        
        const landlord = req.userData.userId;
        
        // 1. Upload des images sur Cloudinary
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await cloudinary.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    { folder: "g-house-housing" } 
                );
                imageUrls.push(result.secure_url);
            }
        }
        
        // 2. Création du logement
        const newHousing = new Housing({
            title,
            description,
            price: Number(price), // Assurez-vous que price est un nombre
            landlord,
            // 🔑 Utilisation des champs individuels pour construire l'objet location
            location: {
                 address: address, 
                 city: city, 
                 zipCode: zipCode 
            },
            type,
            // S'assurer que les amenities sont un tableau
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            images: imageUrls
        });

        // La validation Mongoose se fait ici
        await newHousing.save();

        res.status(201).json({ 
            message: 'Logement créé avec succès !', 
            housing: newHousing 
        });

    } catch (error) {
        // Gérer les erreurs de validation Mongoose
        console.error("Erreur sur POST /api/housing :", error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => `Le champ ${err.path.split('.')[1] || err.path} est requis.`).join(' ');
             return res.status(400).json({ message: `Erreur de validation: ${messages}` });
        }
        
        res.status(500).json({ message: 'Erreur serveur lors de la création du logement.' });
    }
});


// Route 4.3 : Récupérer les logements du propriétaire connecté : GET /api/user/housing
app.get('/api/user/housing', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        const housing = await Housing.find({ landlord: userId });
        res.status(200).json({ housing });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de vos annonces.' });
    }
});


// Route 4.4 : Supprimer un logement : DELETE /api/housing/:id
app.delete('/api/housing/:id', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: "Accès refusé. Seul le propriétaire peut supprimer un logement." });
        }
        
        const housingId = req.params.id;
        
        const result = await Housing.findOneAndDelete({ 
            _id: housingId, 
            landlord: req.userData.userId 
        });

        if (!result) {
            return res.status(404).json({ message: 'Logement non trouvé ou vous n\'êtes pas le propriétaire.' });
        }
        
        // TODO: Ajouter la suppression des images de Cloudinary ici
        
        res.status(200).json({ message: 'Logement supprimé avec succès.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression du logement.' });
    }
});

// Route 4.5 : Mettre à jour un logement : PUT /api/housing/:id (Simplifié)
app.put('/api/housing/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: "Accès refusé." });
        }

        const housingId = req.params.id;
        
        // 🔑 Gestion des données de formulaire pour la mise à jour (similaire au POST)
        const { 
            title, description, price, type, amenities, 
            address, city, zipCode // Assurez-vous de récupérer ces champs
        } = req.body;
        
        const updateFields = {
            title,
            description,
            price: Number(price),
            type,
            amenities: amenities ? amenities.split(',').map(a => a.trim()) : [],
            location: {
                 address, city, zipCode
            }
        };

        // 1. Upload de nouvelles images si fournies
        const imageUrls = [];
        if (req.files && req.files.length > 0) {
            // Logique de remplacement / ajout d'images ici
            for (const file of req.files) {
                const result = await cloudinary.uploader.upload(
                    `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
                    { folder: "g-house-housing" } 
                );
                imageUrls.push(result.secure_url);
            }
            updateFields.images = imageUrls;
        }

        const updatedHousing = await Housing.findOneAndUpdate(
            { _id: housingId, landlord: req.userData.userId }, // Trouver par ID et propriétaire
            { $set: updateFields },
            { new: true, runValidators: true } // Retourner le document mis à jour et exécuter les validateurs
        );

        if (!updatedHousing) {
            return res.status(404).json({ message: 'Logement non trouvé ou non autorisé.' });
        }

        res.status(200).json({ message: 'Logement mis à jour avec succès.', housing: updatedHousing });

    } catch (error) {
        console.error("Erreur sur PUT /api/housing/:id :", error);
         if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => `Le champ ${err.path.split('.')[1] || err.path} est requis.`).join(' ');
             return res.status(400).json({ message: `Erreur de validation: ${messages}` });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du logement.' });
    }
});

// ====================================================================
// 5. ROUTES RÉSERVATIONS (BOOKINGS) - AJOUTÉ POUR LES ERREURS 404/500
// ====================================================================

// Route 5.1 : Récupérer les réservations d'un propriétaire (pour le Dashboard) : GET /api/bookings (CORRIGE LE 404)
app.get('/api/bookings', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: "Accès refusé. Seul le propriétaire peut voir ses réservations." });
        }
        const userId = req.userData.userId; 

        // 1. Trouver les IDs des logements de ce propriétaire
        const landlordHousingIds = await Housing.find({ landlord: userId }).select('_id');
        const housingIds = landlordHousingIds.map(h => h._id);

        // 2. Trouver les réservations pour ces logements
        const bookings = await Booking.find({ 
            housing: { $in: housingIds } 
        })
        .populate('housing', 'title') // Pour afficher le titre
        .populate('tenant', 'name email'); // Pour afficher le locataire

        res.status(200).json({ bookings });

    } catch (error) {
        console.error("Erreur sur GET /api/bookings :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des réservations.' });
    }
});


// Route 5.2 : Mettre à jour le statut d'une réservation : PUT /api/bookings/:id/status (AJOUTÉ POUR LE DASHBOARD)
app.put('/api/bookings/:id/status', authMiddleware, async (req, res) => {
    try {
        if (req.userData.userRole !== 'landlord') {
            return res.status(403).json({ message: "Accès refusé. Seul le propriétaire peut modifier le statut d'une réservation." });
        }

        const { id } = req.params;
        const { status } = req.body;

        // Validation du statut
        if (!['confirmed', 'cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide. Doit être "confirmed" ou "cancelled".' });
        }

        // Trouver la réservation et vérifier l'appartenance
        const booking = await Booking.findById(id).populate('housing', 'landlord');

        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        // Vérifier que le logement appartient bien au propriétaire connecté
        if (booking.housing.landlord.toString() !== req.userData.userId) {
            return res.status(403).json({ message: 'Accès refusé. Cette réservation ne concerne pas un de vos logements.' });
        }

        // Mise à jour du statut
        booking.status = status;
        await booking.save();

        // TODO: Envoi d'une notification ou d'un email au locataire

        res.status(200).json({ message: `Statut mis à jour à ${status}`, booking });

    } catch (error) {
        console.error("Erreur sur PUT /api/bookings/:id/status :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du statut de la réservation.' });
    }
});


// ====================================================================
// 6. ROUTES MESSAGERIE (CONVERSATIONS) - (Similaire à index (7).js)
// ====================================================================

// Route pour récupérer les conversations de l'utilisateur
app.get('/api/conversations', authMiddleware, async (req, res) => {
    try {
        const userId = req.userData.userId;
        
        const conversations = await Conversation.find({ participants: userId })
            .populate('participants', 'name email') 
            .populate({
                path: 'lastMessage',
                select: 'content sender createdAt'
            })
            .sort({ updatedAt: -1 });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des conversations.' });
    }
});

// Route pour démarrer une nouvelle conversation (POST /api/conversations/start)
app.post('/api/conversations/start', authMiddleware, async (req, res) => {
    try {
        const currentUserId = req.userData.userId;
        const { recipientId } = req.body;

        if (currentUserId === recipientId) {
            return res.status(400).json({ message: "Vous ne pouvez pas démarrer une conversation avec vous-même." });
        }

        // Vérifier si une conversation existe déjà
        let conversation = await Conversation.findOne({
            participants: { $all: [currentUserId, recipientId] }
        });

        if (!conversation) {
            // Créer une nouvelle conversation si elle n'existe pas
            conversation = new Conversation({
                participants: [currentUserId, recipientId]
            });
            await conversation.save();
        }

        // Retourner l'ID de la conversation existante ou nouvellement créée
        res.status(200).json({ message: "Conversation prête.", conversationId: conversation._id });

    } catch (error) {
        console.error("Erreur sur POST /api/conversations/start :", error);
        res.status(500).json({ message: 'Erreur serveur lors du démarrage de la conversation.' });
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
                                    .sort({ createdAt: 1 });
                                    
        res.status(200).json({ messages });
    } catch (error) {
        console.error("Erreur sur GET /api/conversations/:id/messages :", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des messages.' });
    }
});


// ====================================================================
// 7. GESTION DES WEBSOCKETS (inchangée)
// ====================================================================

// Initialisation du serveur WebSocket
const wss = new WebSocket.Server({ server });

// Map pour associer userId et l'instance WebSocket
const userWsMap = new Map(); 

wss.on('connection', (ws, req) => {
    // 1. Authentification au moment de la connexion
    let userId = null;
    let userRole = null;

    // Tente d'extraire le token du query string (ex: ws://.../?token=...)
    // Attention: l'implémentation d'une auth complète ici est plus complexe, 
    // on suppose que le middleware auth est utilisé pour le message.
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const token = urlParams.get('token');

    if (token) {
        try {
            const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
            userId = decodedToken.userId;
            userRole = decodedToken.role;
            userWsMap.set(userId, ws); // Associer l'ID utilisateur à l'instance WebSocket
            console.log(`Utilisateur connecté via WebSocket: ${userId}`);
        } catch (error) {
            console.error('Authentification WebSocket échouée:', error.message);
            ws.close(1008, 'Authentification requise');
            return;
        }
    } else {
        ws.close(1008, 'Token manquant');
        return;
    }


    // 2. Réception des messages
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'SEND_MESSAGE' && userId) {
                const { conversationId, content, recipientId } = data;
                
                // 1. Sauvegarder le message dans la base de données
                const newMessage = new Message({
                    conversation: conversationId,
                    sender: userId,
                    content: content
                });
                await newMessage.save();

                // 2. Mettre à jour la conversation (lastMessage et updatedAt)
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: newMessage._id,
                    updatedAt: Date.now()
                });

                // 3. Préparer et envoyer le message aux destinataires
                const messageToSend = {
                    type: 'NEW_MESSAGE',
                    payload: {
                        _id: newMessage._id,
                        content: newMessage.content,
                        sender: { _id: userId, name: userWsMap.get(userId)?.name || 'Moi' }, // Le nom n'est pas stocké dans la map, mais on le laisse pour l'exemple
                        createdAt: newMessage.createdAt,
                        conversationId: conversationId,
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


// ----------------------------------------------------
// ROUTES DE FIN ET DÉMARRAGE DU SERVEUR
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