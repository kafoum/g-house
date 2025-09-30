import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Nécessaire pour les redirections dans le logout
import { loginUser, registerUser } from '../api/api'; // Importez les fonctions Axios

// Crée le Contexte
const AuthContext = createContext(null);

// Custom hook pour utiliser le contexte facilement
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};

// Composant Provider
export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  // user contiendra { id, name, role, email, ...}
  const [user, setUser] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);

  // --- 1. Initialisation : Chargement depuis localStorage ---
  useEffect(() => {
    // Tente de récupérer les informations de l'utilisateur depuis le localStorage
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user'); 

    if (storedToken && storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            // Si l'application se monte, on met l'utilisateur en mémoire
            setUser(parsedUser);
            // Note : Pour une sécurité maximale, on ferait ici un appel API pour vérifier la validité du token.
        } catch (e) {
            console.error("Erreur lors du parsing de l'utilisateur stocké:", e);
            // En cas d'erreur de parsing ou de token invalide, on efface tout.
            localStorage.clear();
        }
    }
    setIsLoading(false);
  }, []);


  // --- 2. Fonction de connexion ---
  const login = async (email, password) => {
    setIsLoading(true);
    try {
      // Axios renvoie la réponse dans l'objet "data"
      const response = await loginUser(email, password); 
      const { token, user: userData } = response.data; // Le backend renvoie { token, user: { id, name, role, ... } }

      // Mise à jour de l'état
      setUser(userData);

      // Stockage local pour la persistance et l'intercepteur Axios
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setIsLoading(false);
      
      // Retourne les données utilisateur pour permettre la redirection dans Login.jsx
      return userData; 
    } catch (error) {
      // Axios place l'erreur dans error.response pour les statuts HTTP 4xx/5xx
      setIsLoading(false);
      throw error.response?.data?.message || 'Erreur inconnue lors de la connexion.';
    }
  };

  // --- 3. Fonction d'inscription ---
  const register = async (userData) => {
    try {
        await registerUser(userData);
        // Le backend renvoie un message de succès.
    } catch (error) {
        throw error.response?.data?.message || "Erreur inconnue lors de l'inscription.";
    }
  }

  // --- 4. Fonction de déconnexion ---
  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Redirige toujours l'utilisateur vers la page d'accueil ou de connexion
    navigate('/login'); 
  };

  // Objet de valeur du contexte
  const value = {
    user,
    isLoading,
    isLoggedIn: !!user,
    role: user ? user.role : null,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* N'affiche l'application que lorsque l'état initial a été chargé (vérif localStorage) */}
      {!isLoading && children} 
    </AuthContext.Provider>
  );
};