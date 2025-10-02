import axios from 'axios';

// ======================================================================
// 1. CONFIGURATION DE L'INSTANCE AXIOS
// ======================================================================

// ATTENTION : REMPLACEZ CETTE VALEUR PAR L'URL DE VOTRE API RENDER
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
 * à toutes les requêtes.
 */
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token'); 

    if (token) {
        config.headers.Authorization = `Bearer ${token}`; 
    }

    // ✅ CORRECTION DU 403 (Token/FormData) : Le Content-Type doit être supprimé 
    // pour les requêtes FormData (upload de fichiers) pour que le navigateur le gère correctement.
    if (config.data instanceof FormData) {
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
 * Connexion de l'utilisateur : POST /login
 */
export const login = (email, password) => {
    return api.post('/login', { email, password });
};

/**
 * Inscription de l'utilisateur : POST /register
 */
export const register = (userData) => {
    return api.post('/register', userData);
};


// ======================================================================
// 4. FONCTIONS LOGEMENTS
// ======================================================================

/**
 * Récupérer la liste des logements : GET /housing
 */
export const getHousingList = (filters) => {
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
 */
export const createHousing = (housingData) => {
    return api.post('/housing', housingData);
};

/**
 * Modifier un logement : PUT /housing/:id
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
 * Récupérer les logements d'un propriétaire : GET /user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};


// ======================================================================
// 5. FONCTIONS RÉSERVATIONS
// ======================================================================

/**
 * Créer une session de réservation (Stripe Checkout) : POST /create-booking-session
 */
export const createBookingSession = (bookingData) => {
    return api.post('/create-booking-session', bookingData);
};

/**
 * Récupérer les réservations d'un utilisateur (locataire ou propriétaire) : GET /bookings
 */
// ✅ CORRECTION DU 404 : La route backend est simplement /api/bookings
export const getBookings = () => {
    return api.get('/bookings'); 
};

/**
 * Mettre à jour le statut d'une réservation (uniquement pour le propriétaire) : PUT /bookings/:id/status
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/bookings/${bookingId}/status`, { status });
};


// ======================================================================
// 6. FONCTIONS CONVERSATIONS/MESSAGERIE
// ======================================================================

/**
 * Démarrer une conversation ou récupérer une conversation existante : POST /conversations/start
 */
export const startConversation = (recipientId, housingId = null) => {
    return api.post('/conversations/start', { recipientId, housingId });
};

/**
 * Récupérer la liste des conversations de l'utilisateur : GET /conversations
 */
// ✅ CORRECTION DU BUILD : Ajout de la fonction manquante
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
// 9. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;