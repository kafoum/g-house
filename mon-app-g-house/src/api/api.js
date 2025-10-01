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
    return Promise.reject(error);
});

// ======================================================================
// 3. FONCTIONS D'APPEL API
// ======================================================================

// --- AUTHENTIFICATION & UTILISATEUR (User.js) ---

/**
 * Connexion utilisateur : POST /api/login 
 */
export const loginUser = (email, password) => {
    // Note : Pas besoin d'ajouter le token, car la connexion ne le nécessite pas
    return api.post('/api/login', { email, password });
};

/**
 * Inscription utilisateur : POST /api/register 
 */
export const registerUser = (userData) => {
    return api.post('/api/register', userData);
};

/**
 * Récupérer les informations de l'utilisateur connecté : GET /api/user/profile 
 * Note : Le token est automatiquement ajouté par l'intercepteur.
 */
export const getUserProfile = () => {
    return api.get('/api/user/profile');
};


// --- GESTION DES ANNONCES (Housing.js) ---

/**
 * Récupération de toutes les annonces : GET /api/housing
 * @param {object} params - Filtres de requête (ex: { city: 'Paris', price_min: 500 })
 */
export const getHousingList = (params = {}) => {
    // Axios gère automatiquement la sérialisation des paramètres de requête (params)
    return api.get('/api/housing', { params });
};

/**
 * Récupération d'une annonce par ID : GET /api/housing/:id
 */
export const getHousingDetails = (housingId) => {
    return api.get(`/api/housing/${housingId}`);
};

/**
 * Création d'une nouvelle annonce : POST /api/housing
 * @param {FormData} housingData - FormData contenant les champs texte et 'images'
 */
export const createHousing = (housingData) => {
    // Axios gère l'upload de FormData, et l'intercepteur gère le token
    return api.post('/api/housing', housingData);
};

/**
 * Modification d'une annonce existante : PUT /api/housing/:id
 */
export const updateHousing = (housingId, housingData) => {
    return api.put(`/api/housing/${housingId}`, housingData);
};

/**
 * Récupération des annonces du propriétaire : GET /api/user/housing
 */
export const getUserHousing = () => {
    return api.get('/api/user/housing');
};

/**
 * Suppression d'une annonce : DELETE /api/housing/:id
 */
export const deleteHousing = (housingId) => {
    return api.delete(`/api/housing/${housingId}`);
};


// --- GESTION DES RÉSERVATIONS (Booking.js) ---

/**
 * Faire une demande de réservation : POST /api/bookings
 * @param {object} bookingData - { housingId, startDate, endDate }
 */
export const createBooking = (bookingData) => {
    return api.post('/api/bookings', bookingData);
};

/**
 * Récupérer la liste des réservations de l'utilisateur (locataire ou propriétaire) : GET /api/bookings
 */
export const getBookings = () => {
    return api.get('/api/bookings');
};

/**
 * Mettre à jour le statut d'une réservation : PUT /api/bookings/:id
 * @param {string} bookingId - ID de la réservation
 * @param {string} status - Nouveau statut ('confirmed', 'cancelled', 'pending')
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/api/bookings/${bookingId}`, { status });
};


// --- MESSAGERIE (Conversation.js, Message.js) ---

/**
 * Démarrer ou obtenir une conversation : POST /api/conversations/start
 * @param {string} recipientId - ID de l'autre participant
 * @param {string|null} housingId - ID du logement (optionnel)
 */
export const startConversation = (recipientId, housingId = null) => {
    return api.post('/api/conversations/start', { recipientId, housingId });
};

/**
 * Récupérer la liste des conversations de l'utilisateur : GET /api/conversations
 */
export const getConversationsList = () => {
    return api.get('/api/conversations');
};

/**
 * Récupérer les messages d'une conversation : GET /api/conversations/:id/messages
 */
export const getMessages = (conversationId) => {
    return api.get(`/api/conversations/${conversationId}/messages`);
};

// Note : L'envoi de messages se fait par WebSocket, pas d'appel API REST POST ici


// --- DOCUMENTS DE PROFIL (ProfileDoc.js) ---

/**
 * Télécharger un document de profil : POST /api/user/documents
 * @param {FormData} docData - FormData contenant 'docType' et le fichier
 */
export const uploadProfileDocument = (docData) => {
    return api.post('/api/user/documents', docData);
};

/**
 * Récupérer la liste des documents de l'utilisateur : GET /api/user/documents
 */
export const getProfileDocuments = () => {
    return api.get('/api/user/documents');
};


// --- NOTIFICATIONS (Notification.js) ---

/**
 * Récupérer les notifications de l'utilisateur : GET /api/notifications
 */
export const getNotifications = () => {
    return api.get('/api/notifications');
};

/**
 * Marquer une notification comme lue : PUT /api/notifications/:id/read
 */
export const markNotificationAsRead = (notificationId) => {
    return api.put(`/api/notifications/${notificationId}/read`, { isRead: true });
};


export default api;