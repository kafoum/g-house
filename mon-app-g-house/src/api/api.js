import axios from 'axios';

// ======================================================================
// 1. CONFIGURATION DE L'INSTANCE AXIOS
// ======================================================================

// ATTENTION : REMPLACEZ CETTE VALEUR PAR L'URL DE VOTRE API RENDER
// Utilisez import.meta.env.VITE_API_URL pour un environnement Vite/React
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://g-house-api.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ======================================================================
// 2. INTERCEPTEUR POUR L'AUTHENTIFICATION (JWT)
// ======================================================================

/**
 * Intercepteur de requête pour ajouter le token JWT 
 * à toutes les requêtes qui en ont besoin.
 */
api.interceptors.request.use(config => {
    // Récupère le token depuis le stockage local
    const token = localStorage.getItem('token'); 

    // Si le token existe, l'ajoute à l'en-tête Authorization
    if (token) {
        // La structure 'Bearer <token>' est requise par votre 'authMiddleware'
        config.headers.Authorization = `Bearer ${token}`; 
    }

    // Le Content-Type doit être supprimé pour les requêtes FormData (upload de fichiers)
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    return config;
}, error => {
    return Promise.reject(error);
});


// ======================================================================
// 3. FONCTIONS D'EXPOSITION DE L'API
// ======================================================================

// --- AUTHENTIFICATION (User.js) ---

/**
 * Inscription d'un nouvel utilisateur : POST /api/register
 */
export const register = (formData) => {
    return api.post('/register', formData);
};

/**
 * Connexion d'un utilisateur : POST /api/login
 */
export const login = (credentials) => {
    return api.post('/login', credentials);
};


// --- GESTION DES LOGEMENTS (Housing.js) ---

/**
 * Récupérer la liste des logements (avec filtres optionnels) : GET /api/housing
 * @param {object} [params] - Paramètres de filtre (city, price_min, price_max, type)
 */
export const getHousingList = (params = {}) => {
    return api.get('/housing', { params });
};

/**
 * Récupérer les détails d'un logement : GET /api/housing/:id
 */
export const getHousingDetails = (id) => {
    return api.get(`/housing/${id}`);
};

/**
 * Créer une nouvelle annonce de logement : POST /api/housing
 * @param {FormData} housingData - FormData contenant les champs de l'annonce et les fichiers images
 */
export const createHousing = (housingData) => {
    return api.post('/housing', housingData);
};

/**
 * Mettre à jour une annonce de logement : PUT /api/housing/:id
 * @param {string} id - L'ID du logement à mettre à jour
 * @param {FormData} housingData - FormData contenant les champs de l'annonce et les nouveaux fichiers images
 */
export const updateHousing = (id, housingData) => {
    return api.put(`/housing/${id}`, housingData);
};

/**
 * Supprimer une annonce de logement : DELETE /api/housing/:id
 */
export const deleteHousing = (id) => {
    return api.delete(`/housing/${id}`);
};

/**
 * Récupérer les logements du propriétaire connecté : GET /api/user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};


// --- GESTION DES RÉSERVATIONS (Booking.js) ---

/**
 * Récupérer toutes les réservations liées aux logements de l'utilisateur (pour le propriétaire) : GET /api/bookings
 */
export const getBookings = () => {
    return api.get('/bookings');
};

/**
 * Mettre à jour le statut d'une réservation : PUT /api/bookings/:id/status
 * @param {string} bookingId - L'ID de la réservation à mettre à jour
 * @param {string} status - Le nouveau statut ('confirmed' ou 'cancelled')
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/bookings/${bookingId}/status`, { status });
};


// 🔑 --- PAIEMENT (Stripe) ---

/**
 * Créer une session de paiement Stripe pour une réservation : POST /api/create-checkout-session
 * @param {object} bookingData - Données de la réservation (housingId, startDate, endDate, totalAmount, landlordId)
 * @returns {Promise<{sessionId: string, bookingId: string}>} - L'ID de session Stripe et l'ID de la réservation temporaire
 */
export const createPaymentSession = (bookingData) => {
    return api.post('/create-checkout-session', bookingData);
};


// --- MESSAGERIE (Conversation.js, Message.js) ---

/**
 * Démarrer une conversation ou récupérer l'existante : POST /api/conversations/start
 * @param {string} recipientId - L'ID de l'autre participant
 * @param {string} [housingId] - L'ID du logement si la conversation est initiée depuis une annonce
 */
export const startConversation = (recipientId, housingId = null) => {
    return api.post('/conversations/start', { recipientId, housingId });
};

/**
 * Récupérer la liste des conversations de l'utilisateur : GET /api/conversations
 */
export const getConversationsList = () => {
    return api.get('/conversations');
};

/**
 * Récupérer les messages d'une conversation : GET /api/conversations/:id/messages
 */
export const getMessages = (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages`);
};

// Note : L'envoi de messages se fait par WebSocket


// --- DOCUMENTS DE PROFIL (ProfileDoc.js) ---

/**
 * Télécharger un document de profil : POST /api/user/documents
 * @param {FormData} docData - FormData contenant 'docType' et le fichier
 */
export const uploadProfileDocument = (docData) => {
    return api.post('/user/documents', docData);
};

/**
 * Récupérer la liste des documents de l'utilisateur : GET /api/user/documents
 */
export const getProfileDocuments = () => {
    return api.get('/user/documents');
};


// --- NOTIFICATIONS (Notification.js) ---

/**
 * Récupérer les notifications de l'utilisateur : GET /api/notifications
 */
export const getNotifications = () => {
    return api.get('/notifications');
};

/**
 * Marquer une notification comme lue : PUT /api/notifications/:id/read
 */
export const markNotificationAsRead = (notificationId) => {
    return api.put(`/notifications/${notificationId}/read`);
};

// ======================================================================
// 4. EXPORT PAR DÉFAUT (L'instance axios brute)
// ======================================================================

// Exportez l'instance par défaut pour les usages génériques si nécessaire
export default api;