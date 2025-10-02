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
// 3. FONCTIONS AUTHENTIFICATION (LA CORRECTION EST ICI)
// ======================================================================

/**
 * Fonction de connexion : POST /login
 * @param {object} credentials - L'objet contenant { email, password }
 */
export const login = (credentials) => {
    // 🔑 CORRECTION CRITIQUE : Envoi direct de l'objet { email, password }
    // Anciennement: api.post('/login', { email: credentials }) -> CAUSE DU BUG
    return api.post('/login', credentials); 
};


/**
 * Fonction d'inscription : POST /register
 * @param {object} userData - L'objet contenant les données d'inscription
 */
export const register = (userData) => {
    return api.post('/register', userData);
};


// ======================================================================
// 4. FONCTIONS LOGEMENTS (HOUSING)
// ======================================================================

/**
 * Récupérer tous les logements (avec filtres) : GET /housing
 * @param {object} params - Paramètres de filtre (city, price_min, price_max, type)
 */
export const getHousingList = (params) => {
    // Envoie les paramètres sous forme de query string: /housing?city=Paris&...
    return api.get('/housing', { params });
};

/**
 * Récupérer les détails d'un logement spécifique : GET /housing/:id
 * @param {string} housingId - L'ID du logement
 */
export const getHousingDetails = (housingId) => {
    return api.get(`/housing/${housingId}`);
};

/**
 * Créer un nouveau logement : POST /housing
 * @param {FormData} housingData - FormData contenant les données du logement et les images
 */
export const createHousing = (housingData) => {
    return api.post('/housing', housingData);
};

/**
 * Mettre à jour un logement existant : PUT /housing/:id
 * @param {string} housingId - L'ID du logement à mettre à jour
 * @param {FormData} housingData - FormData contenant les données mises à jour
 */
export const updateHousing = (housingId, housingData) => {
    // Note: Utiliser PUT/PATCH avec FormData peut nécessiter une configuration spécifique
    // ou l'utilisation d'une méthode de contournement pour les fichiers.
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
 * Récupérer les logements créés par le propriétaire connecté : GET /user/housing
 */
export const getUserHousing = () => {
    return api.get('/user/housing');
};


// ======================================================================
// 5. FONCTIONS RÉSERVATIONS (BOOKINGS)
// ======================================================================

/**
 * Créer une session de paiement Stripe et une pré-réservation : POST /bookings/create-session
 * @param {object} bookingData - Les données de réservation (housingId, startDate, endDate, totalPrice)
 */
export const createBookingSession = (bookingData) => {
    return api.post('/bookings/create-session', bookingData);
};

/**
 * Récupérer toutes les réservations (pour le propriétaire) : GET /bookings
 */
export const getBookings = () => {
    return api.get('/bookings');
};

/**
 * Mettre à jour le statut d'une réservation : PUT /bookings/:id/status
 * @param {string} bookingId - L'ID de la réservation
 * @param {string} status - Le nouveau statut ('confirmed', 'cancelled', 'completed')
 */
export const updateBookingStatus = (bookingId, status) => {
    // Envoie l'objet simple { status: 'nouveau_statut' }
    return api.put(`/bookings/${bookingId}/status`, { status });
};


// ======================================================================
// 6. FONCTIONS MESSAGERIE (CONVERSATIONS / MESSAGES)
// ======================================================================

/**
 * Démarrer ou obtenir une conversation avec un autre utilisateur : POST /conversations/start
 * @param {string} recipientId - L'ID de l'utilisateur destinataire
 */
export const startConversation = (recipientId) => {
    // Crée une conversation avec l'utilisateur actuel et le destinataire
    return api.post('/conversations/start', { recipientId });
};

/**
 * Récupérer la liste des conversations de l'utilisateur : GET /conversations
 */
export const getConversations = () => {
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