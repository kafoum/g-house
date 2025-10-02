// Fichier : frontend/src/api/api.js

import axios from 'axios';

// ======================================================================
// 1. CONFIGURATION DE L'INSTANCE AXIOS
// ======================================================================

// 🚨 CLÉ DE LA CORRECTION : VÉRIFIEZ ABSOLUMENT QUE VITE_API_URL EST CORRECTE DANS VOTRE .env ET SUR VOTRE HÉBERGEUR
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

    // 🔑 Assurer que Content-Type n'est pas inclus pour les uploads de fichiers (FormData)
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

// Cette fonction doit marcher même si l'utilisateur n'est pas connecté
export const getHousingList = () => {
    return api.get('/housing');
};

export const getHousingDetails = (id) => {
    return api.get(`/housing/${id}`);
};

export const getUserHousing = () => {
    return api.get('/user/housing'); // Protégée par authMiddleware
};

// Utiliser FormData dans le composant appelant
export const createHousing = (housingData) => {
    return api.post('/user/housing', housingData); 
};

// Utiliser FormData dans le composant appelant
export const updateHousing = (id, housingData) => {
    return api.put(`/user/housing/${id}`, housingData); 
};

export const deleteHousing = (id) => {
    return api.delete(`/user/housing/${id}`);
};


// ======================================================================
// 5. FONCTIONS RÉSERVATIONS & PAIEMENT
// ======================================================================

export const getBookings = () => {
    return api.get('/user/bookings'); // Protégée par authMiddleware
};

// 🔑 Ajout de la fonction de création de session de paiement Stripe
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

// 🔑 Fonction pour démarrer une nouvelle conversation
export const startConversation = (housingId, recipientId) => {
    return api.post('/conversations/start', { housingId, recipientId });
};

// 🔑 Fonction pour récupérer les messages
export const getMessages = (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages`);
};


// ======================================================================
// 7. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;