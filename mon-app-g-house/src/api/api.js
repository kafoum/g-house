// Fichier : frontend/src/api/api.js (Version Finale)

import axios from 'axios';

// ======================================================================
// 1. CONFIGURATION DE L'INSTANCE AXIOS
// ======================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://g-house-api.onrender.com/api'; 
console.log("API BASE URL:", API_BASE_URL);

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

// ... (Autres fonctions d'authentification)

// ======================================================================
// 4. FONCTIONS LOGEMENTS (HOUSING)
// ======================================================================

export const createHousing = (housingData) => {
    return api.post('/housing', housingData); 
};

export const getHousingList = (params) => {
    return api.get('/housing', { params });
};

// Fonction correcte (au singulier)
export const getHousingDetail = (id) => {
    return api.get(`/housing/${id}`);
};

/**
 * 🔑 CORRECTION VERCEL : Ajout de la fonction manquante (au pluriel) pour la compatibilité avec CreateHousing.jsx
 * Elle est un alias pour la fonction correcte `getHousingDetail`.
 */
export const getHousingDetails = (id) => {
    return getHousingDetail(id); 
};

export const deleteHousing = (id) => {
    return api.delete(`/housing/${id}`);
};

// ... (Autres fonctions Housing)

// ======================================================================
// 5. FONCTIONS RÉSERVATIONS & PAIEMENT
// ======================================================================

export const getBookings = () => {
    return api.get('/user/bookings'); 
};

export const createBookingSession = (bookingData) => {
    return api.post('/bookings/create-checkout-session', bookingData);
};

export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/user/bookings/${bookingId}/status`, { status });
};


// ======================================================================
// 6. FONCTIONS MESSAGERIE (Conversations & Messages)
// ======================================================================

export const getConversationsList = () => {
    return api.get('/conversations');
};

export const startConversation = (housingId, recipientId) => {
    return api.post('/conversations/start', { housingId, recipientId });
};

/**
 * Récupère les détails d'une conversation (pour corriger l'erreur de Conversation.jsx).
 */
export const getConversationDetails = (conversationId) => {
    return api.get(`/conversations/${conversationId}`);
};


/**
 * Récupérer tous les messages d'une conversation (pour l'historique).
 */
export const getMessages = (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages`);
};


// ======================================================================
// 7. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;