// frontend/src/api/api.js

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
 * à toutes les requêtes qui en ont besoin.
 */
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token'); 

    if (token) {
        config.headers.Authorization = `Bearer ${token}`; 
    }

    // Le Content-Type doit être supprimé pour les requêtes FormData (upload de fichiers)
    if (config.data instanceof FormData) {
        // CORRECTION DU 403 : S'assurer que le navigateur gère le multipart/form-data
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
 * Le Content-Type est géré par l'intercepteur car c'est un FormData.
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
 * Le backend détermine le rôle et filtre en conséquence.
 */
export const getBookings = () => {
    // ✅ CORRECTION 404 : La route backend est simplement /api/bookings
    return api.get('/bookings'); 
};

/**
 * Mettre à jour le statut d'une réservation (uniquement pour le propriétaire) : PUT /bookings/:id/status
 */
export const updateBookingStatus = (bookingId, status) => {
    return api.put(`/bookings/${bookingId}/status`, { status });
};

// ... (Ajouter ici les autres fonctions d'API pour Conversations, Messages, etc.)

// ======================================================================
// 10. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;