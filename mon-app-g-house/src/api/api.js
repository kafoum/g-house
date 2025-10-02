// Fichier : frontend/src/api/api.js

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

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token'); 

    if (token) {
        config.headers.Authorization = `Bearer ${token}`; 
    }

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

export const register = (userData) => {
    return api.post('/register', userData);
};

export const login = (credentials) => {
    return api.post('/login', credentials);
};


// ======================================================================
// 4. FONCTIONS LOGEMENTS (Housing)
// ======================================================================

export const getHousingList = () => {
    return api.get('/housing');
};

export const getHousingDetails = (id) => {
    return api.get(`/housing/${id}`);
};

export const createHousing = (housingData) => {
    return api.post('/user/housing', housingData); // housingData doit être un FormData
};

export const updateHousing = (id, housingData) => {
    return api.put(`/user/housing/${id}`, housingData); // housingData doit être un FormData
};

export const deleteHousing = (id) => {
    return api.delete(`/user/housing/${id}`);
};

export const getUserHousing = () => {
    return api.get('/user/housing');
};


// ======================================================================
// 5. FONCTIONS RÉSERVATIONS & PAIEMENT
// ======================================================================

export const getBookings = () => {
    return api.get('/user/bookings');
};

export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/user/bookings/${bookingId}/status`, { status });
};

/**
 * Crée une session de paiement Stripe pour une réservation.
 * 🔑 CORRECTION du "ReferenceError: createBookingSession is not defined"
 * @param {object} bookingData - Contient housingId, startDate, endDate, et totalPrice.
 * @returns {Promise<AxiosResponse>} La session Stripe (avec l'URL de redirection).
 */
export const createBookingSession = (bookingData) => {
    return api.post('/bookings/create-checkout-session', bookingData);
};


// ======================================================================
// 6. FONCTIONS MESSAGERIE (Conversations & Messages)
// ======================================================================

/**
 * Récupère la liste des conversations de l'utilisateur.
 */
export const getConversationsList = () => {
    return api.get('/conversations');
};

/**
 * Démarre une nouvelle conversation ou trouve une conversation existante.
 * 🔑 CORRECTION pour démarrer la conversation (route manquante)
 * @param {string} housingId - L'ID du logement concerné.
 * @param {string} recipientId - L'ID de l'autre utilisateur (landlord/tenant).
 * @returns {Promise<AxiosResponse>} L'objet Conversation.
 */
export const startConversation = (housingId, recipientId) => {
    return api.post('/conversations/start', { housingId, recipientId });
};

/**
 * Récupère les messages d'une conversation.
 * @param {string} conversationId - L'ID de la conversation.
 */
export const getMessages = (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages`);
};

// ... (Ajouter les autres fonctions Profil, Notifications si vous en avez) ...


// ======================================================================
// 7. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;