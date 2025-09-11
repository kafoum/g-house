import axios from 'axios';

// Crée une instance d'Axios personnalisée
const api = axios.create({
  baseURL: 'https://g-house-api.onrender.com/api',
});

// Intercepteur de requêtes : ajoute le token à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur de réponses : gère les erreurs 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Le token est invalide ou a expiré. Déconnecter l'utilisateur.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      
      console.error('Erreur 401: Jeton expiré ou invalide. Déconnexion automatique.');
    }
    return Promise.reject(error);
  }
);

export default api;
