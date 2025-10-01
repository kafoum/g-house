import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// 💡 Correction précédente maintenue : Utilisation de l'alias pour les fonctions d'API
import { login as loginUser, register as registerUser } from '../api/api'; 

// Crée le Contexte
const AuthContext = createContext(null);

// Custom hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur d'un AuthProvider");
  }
  return context;
};

// Composant Provider
export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null); 
  const [isLoading, setIsLoading] = useState(true);

  // --- 1. Initialisation : Chargement depuis localStorage ---
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user'); 

    if (storedToken && storedUser) {
        try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
        } catch (e) {
            console.error("Erreur lors du parsing des données utilisateur:", e);
            // Sécurité : Supprimer les clés si le parsing échoue
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
    // 🔑 CLÉ : Quoi qu'il arrive, on marque la fin du chargement initial pour débloquer l'application
    setIsLoading(false); 
  }, []);

  // --- 2. Fonction de connexion ---
  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await loginUser({ email, password });
      
      const { token, user: userData } = response.data;
      setUser(userData);

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setIsLoading(false);
      return userData; 
    } catch (error) {
      setIsLoading(false);
      throw error.response?.data?.message || 'Erreur inconnue lors de la connexion.';
    }
  };

  // --- 3. Fonction d'inscription ---
  const register = async (userData) => {
    try {
        await registerUser(userData);
    } catch (error) {
        throw error.response?.data?.message || "Erreur inconnue lors de l'inscription.";
    }
  }

  // --- 4. Fonction de déconnexion ---
  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
      {/* 🔑 CLÉ : Bloquer l'affichage des enfants TANT QUE l'état initial n'est pas chargé */}
      {/* C'est le AuthProvider qui doit gérer l'état d'attente global. */}
      {children} 
    </AuthContext.Provider>
  );
};

