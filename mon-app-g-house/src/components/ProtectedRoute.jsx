import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Composant de protection de route.
 * @param {string} [allowedRole=null] - Le rôle requis pour accéder à la route ('tenant' ou 'landlord').
 * @returns {JSX.Element} L'élément enfant (Outlet) si autorisé, ou une redirection.
 */
const ProtectedRoute = ({ allowedRole = null }) => {
  const { isLoggedIn, role, isLoading } = useAuth();

  // 1. 🔑 CLÉ DE LA CORRECTION : Attendre le chargement initial du contexte
  // Tant que isLoading est à true, on affiche un message de chargement.
  // Cela empêche la redirection prématurée vers /login.
  if (isLoading) {
    return <div className="loading-screen">Vérification de l'authentification en cours...</div>; 
  }

  // 2. Vérifier si l'utilisateur est connecté
  if (!isLoggedIn) {
    // Si la vérification est terminée (isLoading est false) et l'utilisateur n'est pas connecté
    return <Navigate to="/login" replace />; 
  }

  // 3. Vérifier le rôle si un rôle spécifique est requis
  if (allowedRole && role !== allowedRole) {
    // Accès refusé
    console.warn(`Accès refusé. Rôle actuel: ${role}, Rôle requis: ${allowedRole}`);
    return <Navigate to="/" replace />; 
  }

  // 4. L'utilisateur est connecté et autorisé : Afficher le contenu
  return <Outlet />;
};

export default ProtectedRoute;