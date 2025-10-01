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
    // Gère les erreurs de requête
    return Promise.reject(error);
});


// ======================================================================
// 3. FONCTIONS D'APPEL À L'API (regroupées par modèle)
// ======================================================================


// ----------------------------------------------------
// --- AUTHENTIFICATION (User.js) ---
// ----------------------------------------------------

/**
 * Inscription d'un nouvel utilisateur : POST /api/register
 * @param {object} userData - { name, email, password, role }
 */
export const register = (userData) => {
    return api.post('/register', userData);
};

/**
 * Connexion d'un utilisateur : POST /api/login
 * @param {object} credentials - { email, password }
 */
export const login = (credentials) => {
    return api.post('/login', credentials);
};

/**
 * Déconnexion (côté client uniquement)
 */
export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    // En fonction de la configuration du backend, un appel POST /logout peut être nécessaire
};


// ----------------------------------------------------
// --- LOGEMENTS (Housing.js) ---
// ----------------------------------------------------

/**
 * Récupérer tous les logements (avec filtres en query params) : GET /api/housing
 * @param {object} [params={}] - Paramètres de requête (ex: { city: 'Paris', price_min: 500 })
 */
export const getAllHousing = (params = {}) => {
    return api.get('/housing', { params });
};

/**
 * Récupérer les détails d'un logement : GET /api/housing/:id
 * @param {string} id - L'ID du logement
 */
export const getHousingDetails = (id) => {
    return api.get(`/housing/${id}`);
};

/**
 * Créer un nouveau logement : POST /api/housing
 * @param {FormData} housingData - FormData contenant les champs texte et les images (files)
 */
export const createHousing = (housingData) => {
    // L'intercepteur gère automatiquement l'en-tête pour FormData
    return api.post('/housing', housingData);
};

/**
 * Mettre à jour un logement : PUT /api/housing/:id
 * @param {string} id - L'ID du logement
 * @param {FormData} housingData - FormData contenant les champs à mettre à jour et potentiellement de nouvelles images
 */
export const updateHousing = (id, housingData) => {
    // L'intercepteur gère automatiquement l'en-tête pour FormData
    return api.put(`/housing/${id}`, housingData);
};

/**
 * Supprimer un logement : DELETE /api/housing/:id
 * @param {string} id - L'ID du logement
 */
export const deleteHousing = (id) => {
    return api.delete(`/housing/${id}`);
};

/**
 * Récupérer les logements d'un propriétaire : GET /api/user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};

// ----------------------------------------------------
// --- RÉSERVATIONS (Booking.js) ---
// ----------------------------------------------------

/**
 * Créer une session de paiement Stripe pour une réservation : POST /api/booking/create-checkout-session
 * @param {object} bookingData - { housingId, startDate, endDate, price }
 */
export const createCheckoutSession = (bookingData) => {
    return api.post('/booking/create-checkout-session', bookingData);
};

/**
 * Récupérer toutes les réservations (pour un propriétaire) : GET /api/bookings
 */
export const getBookings = () => {
    return api.get('/bookings');
};

/**
 * Mettre à jour le statut d'une réservation : PUT /api/bookings/:id/status
 * @param {string} id - L'ID de la réservation
 * @param {string} status - Le nouveau statut ('confirmed' ou 'cancelled')
 */
export const updateBookingStatus = (id, status) => {
    return api.put(`/bookings/${id}/status`, { status });
};


// ----------------------------------------------------
// --- MESSAGERIE (Conversation.js / Message.js) ---
// ----------------------------------------------------

/**
 * Démarrer une conversation ou récupérer une existante : POST /api/conversations/start
 * @param {string} recipientId - L'ID de l'utilisateur avec qui parler
 * @param {string} [housingId=null] - L'ID du logement si la conversation y est liée (optionnel)
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

// Note : L'envoi de messages se fait par WebSocket, pas d'appel API REST POST ici


// ----------------------------------------------------
// --- DOCUMENTS DE PROFIL (ProfileDoc.js) ---
// ----------------------------------------------------

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


// ----------------------------------------------------
// --- NOTIFICATIONS (Notification.js) ---
// ----------------------------------------------------

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

/**
 * Fonction d'export par défaut pour l'instance axios configurée
 */
export default api;