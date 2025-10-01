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
    // Récupère le token depuis le stockage local
    const token = localStorage.getItem('token'); 

    // Si le token existe, l'ajoute à l'en-tête Authorization
    if (token) {
        config.headers.Authorization = `Bearer ${token}`; 
    }

    // Gère le Content-Type pour les requêtes FormData (upload de fichiers)
    if (config.data instanceof FormData) {
        // Supprime Content-Type pour que le navigateur le gère automatiquement
        delete config.headers['Content-Type'];
    }

    return config;
}, error => {
    return Promise.reject(error);
});


// ======================================================================
// 3. FONCTIONS D'AUTHENTIFICATION ET UTILISATEUR
// ======================================================================

/**
 * Inscription d'un nouvel utilisateur : POST /register
 * @param {object} userData - { name, email, password, role }
 */
export const register = (userData) => {
    return api.post('/register', userData);
};

/**
 * Connexion d'un utilisateur : POST /login
 * @param {object} credentials - { email, password }
 */
export const login = (credentials) => {
    return api.post('/login', credentials);
};

/**
 * Récupérer les données du profil utilisateur : GET /user/profile
 */
export const getProfile = () => {
    return api.get('/user/profile');
};


// ======================================================================
// 4. FONCTIONS DE LOGEMENT
// ======================================================================

/**
 * Récupérer la liste des logements : GET /housing
 */
export const getHousingList = (filters = {}) => {
    return api.get('/housing', { params: filters });
};

/**
 * Récupérer les détails d'un logement : GET /housing/:id
 */
export const getHousingDetails = (id) => {
    return api.get(`/housing/${id}`);
};

/**
 * Créer un nouveau logement : POST /housing
 * @param {FormData} housingData - FormData contenant tous les champs + les fichiers images
 */
export const createHousing = (housingData) => {
    return api.post('/housing', housingData);
};

/**
 * Mettre à jour un logement existant : PUT /housing/:id
 * @param {string} id - ID du logement
 * @param {FormData} housingData - FormData contenant les champs mis à jour + les NOUVEAUX fichiers images
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


// ======================================================================
// 5. FONCTIONS PROPRIÉTAIRE (Dashboard)
// ======================================================================

/**
 * Récupérer la liste des logements d'un propriétaire : GET /user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};

/**
 * Récupérer la liste des réservations pour les logements du propriétaire : GET /bookings/landlord
 */
export const getBookings = () => {
    return api.get('/bookings/landlord');
};

/**
 * Mettre à jour le statut d'une réservation : PUT /bookings/:id/status
 * @param {string} bookingId - ID de la réservation
 * @param {string} status - 'confirmed' ou 'cancelled'
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/bookings/${bookingId}/status`, { status });
};


// ======================================================================
// 6. FONCTIONS DE RÉSERVATION/PAIEMENT
// ======================================================================

/**
 * Créer une session de paiement Stripe pour une réservation : POST /bookings/checkout
 * @param {object} bookingData - { housingId, startDate, endDate, price (mensuel) }
 */
export const createPaymentSession = (bookingData) => {
    return api.post('/bookings/checkout', bookingData);
};


// ======================================================================
// 7. FONCTIONS DE MESSAGERIE
// ======================================================================

/**
 * Démarrer ou récupérer une conversation existante : POST /conversations/start
 * @param {string} recipientId - ID de l'utilisateur destinataire
 * @param {string} housingId - ID du logement (optionnel)
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


// ======================================================================
// 8. FONCTIONS DOCUMENTS DE PROFIL
// ======================================================================

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


// ======================================================================
// 9. FONCTIONS NOTIFICATIONS
// ======================================================================

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
// 10. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;