import axios from 'axios';

// ======================================================================
// 1. CONFIGURATION DE L'INSTANCE AXIOS
// ======================================================================

// Utilisez la variable d'environnement définie dans votre fichier .env.local/vite.config.js
// VITE_API_URL devrait pointer vers l'URL de base de votre backend (ex: http://localhost:5000/api ou https://g-house-api.onrender.com/api)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    // Le Content-Type par défaut est géré pour JSON. Il sera annulé pour FormData.
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
    // Axios le gère automatiquement si le body est un FormData.
    if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    return config;
}, error => {
    // Gestion des erreurs de l'intercepteur de requête
    return Promise.reject(error);
});


// ======================================================================
// 3. FONCTIONS D'API EXPORTÉES
// ======================================================================

// --- AUTHENTIFICATION (User.js) ---

/**
 * Inscription d'un nouvel utilisateur : POST /register
 */
export const register = (userData) => {
    // userData doit contenir { name, email, password, role }
    return api.post('/register', userData);
};

/**
 * Connexion d'un utilisateur : POST /login
 */
export const login = (credentials) => {
    // credentials doit contenir { email, password }
    return api.post('/login', credentials);
};

// --- GESTION DES LOGEMENTS (Housing.js) ---

/**
 * Récupérer la liste des logements (avec filtres optionnels) : GET /housing?city=...&price_min=...
 * @param {object} params - Paramètres de la requête (filtres de recherche)
 */
export const getHousingList = (params = {}) => {
    // Les paramètres sont ajoutés automatiquement par Axios
    return api.get('/housing', { params });
};

/**
 * Récupérer les détails d'un logement spécifique : GET /housing/:id
 */
export const getHousingDetails = (id) => {
    return api.get(`/housing/${id}`);
};

/**
 * Créer un nouveau logement : POST /housing
 * @param {FormData} housingData - FormData contenant les champs texte et les fichiers images
 */
export const createHousing = (housingData) => {
    return api.post('/housing', housingData);
};

/**
 * Modifier un logement existant : PUT /housing/:id
 * @param {string} id - L'ID du logement à modifier
 * @param {FormData} housingData - FormData contenant les champs texte et les fichiers images
 */
export const updateHousing = (id, housingData) => {
    return api.put(`/housing/${id}`, housingData);
};

/**
 * Supprimer un logement : DELETE /housing/:id
 */
export const deleteHousing = (id) => {
    return api.delete(`/housing/${id}`);
};

/**
 * Récupérer tous les logements d'un propriétaire (Landlord) : GET /user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};

// --- MESSAGERIE (Conversation.js / Message.js) ---

/**
 * Démarrer ou récupérer une conversation existante : POST /conversations/start
 */
export const startConversation = (recipientId, housingId = null) => {
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


// --- GESTION DES RÉSERVATIONS (Booking.js / Stripe) ---

/**
 * Créer une session de paiement Stripe et une pré-réservation : POST /bookings/create-session
 * @param {object} bookingData - Données de la réservation (housingId, startDate, endDate)
 * @returns {Promise<object>} - Promesse contenant { sessionId: string, bookingId: string }
 */
export const createBookingSession = (bookingData) => {
    // La route de votre backend pour Stripe (index.js) est /api/bookings/create-session
    return api.post('/bookings/create-session', bookingData);
};

/**
 * Récupérer toutes les réservations liées aux logements du propriétaire : GET /user/bookings
 */
export const getBookings = () => {
    return api.get('/user/bookings');
};

/**
 * Mettre à jour le statut d'une réservation (pending, confirmed, cancelled) : PUT /bookings/:id/status
 * @param {string} bookingId - L'ID de la réservation à modifier
 * @param {string} status - Le nouveau statut ('confirmed' ou 'cancelled')
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/bookings/${bookingId}/status`, { status });
};

/**
 * Confirmer le statut de réservation après un paiement réussi (Optionnel/Sécurité)
 * NOTE: Normalement géré par le Webhook Stripe, ceci est une sécurité côté client.
 */
export const confirmBookingStatus = (sessionId, bookingId) => {
    // Si cette route existe sur le backend, elle devrait revérifier le statut Stripe
    return api.post('/bookings/confirm-status', { sessionId, bookingId });
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

// ======================================================================
// 4. EXPORT PAR DÉFAUT (pour les appels de base sans fonction spécifique)
// ======================================================================

export default api;