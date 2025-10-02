import axios from 'axios';

// ======================================================================
// 1. CONFIGURATION DE L'INSTANCE AXIOS
// ======================================================================

// ATTENTION : REMPLACEZ CETTE VALEUR PAR L'URL DE VOTRE API RENDER
// Dans un projet React/Vite, l'idéal est d'utiliser import.meta.env.VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://g-house-api.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    // Note: 'Content-Type': 'application/json' est le défaut, mais il est géré
    // dans l'intercepteur pour permettre les FormData (upload de fichiers).
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
        // (multipart/form-data avec la bonne boundary)
        delete config.headers['Content-Type'];
    }

    return config;
}, error => {
    return Promise.reject(error);
});


// ======================================================================
// 3. FONCTIONS AUTHENTIFICATION
// ======================================================================

/**
 * S'inscrire : POST /register
 */
export const register = (userData) => {
    return api.post('/register', userData);
};

/**
 * Se connecter : POST /login
 */
export const login = (credentials) => {
    return api.post('/login', credentials);
};


// ======================================================================
// 4. FONCTIONS ANNONCES (HOUSING)
// ======================================================================

/**
 * Récupérer la liste de TOUTES les annonces actives : GET /housing
 */
export const getHousingList = () => {
    return api.get('/housing');
};

/**
 * Récupérer les détails d'une annonce : GET /housing/:id
 */
export const getHousingDetails = (id) => {
    return api.get(`/housing/${id}`);
};

/**
 * Récupérer les annonces d'un propriétaire (pour le Dashboard) : GET /user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};

/**
 * Créer une nouvelle annonce : POST /user/housing
 * 🟢 CORRECTION : Utilise la bonne route protégée /user/housing
 * @param {FormData} housingData - FormData contenant toutes les données (y compris les fichiers)
 */
export const createHousing = (housingData) => {
    return api.post('/user/housing', housingData); 
};

/**
 * Mettre à jour une annonce : PUT /user/housing/:id
 * 🟢 CORRECTION : Utilise la bonne route protégée /user/housing/:id
 * @param {string} id - L'ID de l'annonce
 * @param {FormData} housingData - FormData contenant les données
 */
export const updateHousing = (id, housingData) => {
    return api.put(`/user/housing/${id}`, housingData);
};

/**
 * Supprimer une annonce : DELETE /user/housing/:id
 * 🟢 CORRECTION : Utilise la bonne route protégée /user/housing/:id
 */
export const deleteHousing = (id) => {
    return api.delete(`/user/housing/${id}`);
};


// ======================================================================
// 5. FONCTIONS RÉSERVATIONS (BOOKING)
// ======================================================================

/**
 * Créer une nouvelle réservation : POST /bookings
 */
export const createBooking = (bookingData) => {
    return api.post('/bookings', bookingData);
};

/**
 * Récupérer toutes les réservations d'un utilisateur (locataire ou propriétaire) : GET /user/bookings
 */
export const getBookings = () => {
    return api.get('/user/bookings');
};

/**
 * Mettre à jour le statut d'une réservation (Propriétaire uniquement) : PUT /bookings/:id/status
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/bookings/${bookingId}/status`, { status });
};


// ======================================================================
// 6. FONCTIONS MESSAGERIE (CONVERSATIONS / MESSAGES)
// ======================================================================

/**
 * Récupérer la liste des conversations de l'utilisateur : GET /conversations
 */
export const getConversationsList = () => {
    return api.get('/conversations');
};

/**
 * Démarrer une nouvelle conversation : POST /conversations/start
 */
export const startConversation = (data) => {
    return api.post('/conversations/start', data);
};

/**
 * Récupérer les messages d'une conversation : GET /conversations/:id/messages
 */
export const getMessages = (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages`);
};


// ======================================================================
// 7. FONCTIONS DOCUMENTS DE PROFIL
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
// 8. FONCTIONS NOTIFICATIONS
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
// 9. FONCTIONS PAIEMENT (STRIPE)
// ======================================================================

/**
 * Créer une session de paiement Stripe pour une réservation : POST /create-checkout-session
 */
export const createCheckoutSession = (bookingId) => {
    return api.post('/create-checkout-session', { bookingId });
};


// ======================================================================
// 10. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;