import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Composant de protection de route.
 * @param {string} [allowedRole=null] - Le rôle requis pour accéder à la route ('tenant' ou 'landlord'). Si null, seule l'authentification est requise.
 * @returns {JSX.Element} L'élément enfant (Outlet) si autorisé, ou une redirection.
 */
const ProtectedRoute = ({ allowedRole = null }) => {
  const { isLoggedIn, role, isLoading } = useAuth();

  // 1. Attendre le chargement initial du contexte (vérification du localStorage)
  if (isLoading) {
    return <p>Vérification de l'authentification...</p>; // Vous pouvez remplacer par un spinner plus stylisé
  }

  // 2. Vérifier si l'utilisateur est connecté
  if (!isLoggedIn) {
    // Si l'utilisateur n'est pas connecté, le rediriger vers la page de connexion
    // L'état 'replace' garantit que l'historique de navigation n'est pas pollué.
    return <Navigate to="/login" replace />; 
  }

  // 3. Vérifier le rôle si un rôle spécifique est requis
  if (allowedRole && role !== allowedRole) {
    // Si l'utilisateur est connecté mais n'a pas le bon rôle (ex: locataire essaye d'accéder au dashboard)
    // Le rediriger vers une page neutre ou l'accueil.
    console.warn(`Accès refusé. Rôle actuel: ${role}, Rôle requis: ${allowedRole}`);
    return <Navigate to="/" replace />; 
  }

  // 4. Si toutes les conditions sont remplies, autoriser l'accès à la route enfant.
  return <Outlet />; 
};

export default ProtectedRoute;