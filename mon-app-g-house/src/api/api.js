import axios from 'axios';

// Crée une instance d'Axios avec une configuration de base.
const api = axios.create({
  baseURL: 'https://g-house-api.onrender.com/api',
});

// Ajoute un intercepteur pour inclure le token d'authentification dans chaque requête.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
