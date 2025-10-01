import axios from 'axios';

// ======================================================================
// 1. CONFIGURATION DE L'INSTANCE AXIOS
// ======================================================================

// ATTENTION : REMPLACEZ CETTE VALEUR PAR L'URL DE VOTRE API RENDER
// Dans un projet React/Vite, l'idéal est d'utiliser import.meta.env.VITE_API_URL
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
    // Récupère le token depuis le stockage local (ou tout autre gestionnaire d'état)
    const token = localStorage.getItem('token'); 

    // Si le token existe, l'ajoute à l'en-tête Authorization
    if (token) {
        // La structure 'Bearer <token>' est requise par votre 'authMiddleware'
        config.headers.Authorization = `Bearer ${token}`; 
    }

    // Le Content-Type doit être supprimé pour les requêtes FormData (upload de fichiers)
    // Axios le gère automatiquement si le body est un FormData.
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    return config;
}, error => {
    // Gestion des erreurs de requête (ex: token non récupérable)
    return Promise.reject(error);
});

// ======================================================================
// 3. FONCTIONS D'APPEL API
// ======================================================================

// --- AUTHENTIFICATION (User.js) ---

/**
 * Inscription d'un nouvel utilisateur : POST /register
 * @param {object} userData - Données d'inscription (name, email, password, role)
 */
export const registerUser = (userData) => {
    return api.post('/register', userData);
};

/**
 * Connexion d'un utilisateur : POST /login
 * @param {object} credentials - Email et mot de passe ({email, password})
 */
export const loginUser = (credentials) => {
    // Note: Le stockage du token et la gestion du contexte se font dans AuthContext.
    return api.post('/login', credentials);
};


// --- LOGEMENTS (Housing.js) ---

/**
 * Récupérer tous les logements avec options de filtrage/recherche : GET /housing
 * @param {object} params - Paramètres de requête (ex: { city: 'Paris', type: 'studio' })
 */
export const getHousingList = (params = {}) => {
    return api.get('/housing', { params });
};

/**
 * Récupérer les détails d'un logement : GET /housing/:id
 * @param {string} housingId - L'ID du logement
 */
export const getHousingDetails = (housingId) => {
    return api.get(`/housing/${housingId}`);
};

/**
 * Créer un nouveau logement : POST /housing
 * @param {FormData} housingData - Les données du logement, y compris les fichiers images
 */
export const createHousing = (housingData) => {
    return api.post('/housing', housingData);
};

/**
 * Modifier un logement existant : PUT /housing/:id
 * @param {string} housingId - L'ID du logement à modifier
 * @param {FormData} housingData - Les données de mise à jour
 */
export const updateHousing = (housingId, housingData) => {
    return api.put(`/housing/${housingId}`, housingData);
};

/**
 * Supprimer un logement : DELETE /housing/:id
 * @param {string} housingId - L'ID du logement à supprimer
 */
export const deleteHousing = (housingId) => {
    return api.delete(`/housing/${housingId}`);
};

/**
 * Récupérer les logements du propriétaire connecté : GET /user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};

// --- RÉSERVATIONS (Booking.js) ---

/**
 * Créer une session de paiement Stripe pour une réservation : POST /booking/create-checkout-session
 * @param {object} bookingData - Les détails de la réservation (housingId, startDate, endDate)
 */
export const createStripeCheckoutSession = (bookingData) => {
    return api.post('/booking/create-checkout-session', bookingData);
};

/**
 * Confirmer le statut d'une réservation (pour le webhook Stripe côté client si nécessaire) : POST /booking/confirm-status
 * Note : Normalement géré par le Webhook côté serveur.
 */
export const confirmBookingStatus = (sessionId, bookingId) => {
    return api.post('/booking/confirm-status', { sessionId, bookingId });
};

/**
 * Récupérer les réservations pour les logements du propriétaire connecté : GET /landlord/bookings
 */
export const getBookings = () => {
    return api.get('/landlord/bookings');
};

/**
 * Mettre à jour le statut d'une réservation : PUT /booking/:id/status
 * @param {string} bookingId - L'ID de la réservation
 * @param {string} status - Le nouveau statut ('confirmed' ou 'cancelled')
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/booking/${bookingId}/status`, { status });
};

// --- MESSAGERIE (Conversation.js / Message.js) ---

/**
 * Démarrer ou récupérer une conversation avec un autre utilisateur : POST /conversations/start
 * @param {string} recipientId - L'ID de l'autre utilisateur
 * @param {string} [housingId=null] - L'ID du logement (optionnel)
 */
export const startOrGetConversation = (recipientId, housingId = null) => {
    return api.post('/conversations/start', { recipientId, housingId });
};

/**
 * Récupérer la liste des conversations de l'utilisateur : GET /conversations
 */
export const getConversationsList = () => {
    return api.get('/conversations');
};

/**
 * Récupérer les messages d'une conversation : GET /conversations/:id/messages
 */
export const getMessages = (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages`);
};


// --- DOCUMENTS DE PROFIL (ProfileDoc.js) ---

/**
 * Télécharger un document de profil : POST /user/documents
 * @param {FormData} docData - FormData contenant 'docType' et le fichier
 */
export const uploadProfileDocument = (docData) => {
    return api.post('/user/documents', docData);
};

/**
 * Récupérer la liste des documents de l'utilisateur : GET /user/documents
 */
export const getProfileDocuments = () => {
    return api.get('/user/documents');
};


// --- NOTIFICATIONS (Notification.js) ---

/**
 * Récupérer les notifications de l'utilisateur : GET /notifications
 */
export const getNotifications = () => {
    return api.get('/notifications');
};

/**
 * Marquer une notification comme lue : PUT /notifications/:id/read
 */
export const markNotificationAsRead = (notificationId) => {
    return api.put(`/notifications/${notificationId}/read`);
};

// Exporter l'instance configurée pour les utilisations directes si nécessaire
export default api;