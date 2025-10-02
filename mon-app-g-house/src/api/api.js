// Fichier : frontend/src/api/api.js (Version Finale et Complète)

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

    // Gère le cas des uploads de fichiers (FormData)
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
// 4. FONCTIONS LOGEMENTS (HOUSING)
// ======================================================================

export const createHousing = (housingData) => {
    return api.post('/housing', housingData); 
};

export const getHousingList = (params) => {
    return api.get('/housing', { params });
};

export const getHousingDetail = (id) => {
    return api.get(`/housing/${id}`);
};

// Aliases pour corriger les erreurs de compilation (ex: Dashboard.jsx, CreateHousing.jsx)
export const getHousingDetails = (id) => {
    return getHousingDetail(id); 
};

export const updateHousing = (id, housingData) => {
    return api.put(`/housing/${id}`, housingData); 
};

export const deleteHousing = (id) => {
    return api.delete(`/housing/${id}`);
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

export const getConversationDetails = (conversationId) => {
    return api.get(`/conversations/${conversationId}`);
};


export const getMessages = (conversationId) => {
    return api.get(`/conversations/${conversationId}/messages`);
};


// ======================================================================
// 8. FONCTIONS DOCUMENTS DE PROFIL (ProfileDoc)
// ======================================================================

// Télécharge un document de profil (utilise FormData pour les fichiers)
export const uploadProfileDoc = (docType, file) => {
    // Crée un objet FormData pour envoyer le fichier et le type
    const formData = new FormData();
    formData.append('docType', docType);
    formData.append('document', file); // 'document' doit correspondre au nom du champ dans le middleware Multer du backend

    // L'instance 'api' gère déjà l'intercepteur pour les FormData
    return api.post('/profile-docs/upload', formData); 
};

// Récupère la liste des documents de profil de l'utilisateur connecté
export const getMyProfileDocs = () => {
    return api.get('/profile-docs/my-documents');
};

// Récupère les documents d'un locataire spécifique (pour le propriétaire)
export const getTenantProfileDocs = (tenantId) => {
    return api.get(`/profile-docs/tenant/${tenantId}`);
};


// ======================================================================
// 7. EXPORT DE L'INSTANCE AXIOS PAR DÉFAUT
// ======================================================================

export default api;