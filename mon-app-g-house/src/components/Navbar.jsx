import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Importe l'état d'authentification
import './Navbar.css'; // Nous allons créer ce fichier CSS pour le style

const Navbar = () => {
  // Récupération de l'état global via le hook
  const { isLoggedIn, role, logout } = useAuth(); 

  const handleLogout = () => {
    // Appel la fonction logout du contexte, qui gère la déconnexion et la redirection vers /login
    logout(); 
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        {/* Lien vers la page d'accueil (HousingList) */}
        <Link to="/">G-House 🏠</Link>
      </div>
      
      <div className="navbar-links">
        {/* Lien toujours visible : Annonces */}
        <Link to="/">Annonces</Link> 

        {/* --- LIENS CONDITIONNELS : CONNECTÉ --- */}
        {isLoggedIn ? (
          <>
            {/* Liens spécifiques au PROPRIÉTAIRE */}
            {role === 'landlord' && (
              <>
                <Link to="/create-housing">Créer une annonce</Link>
                {/* La route /dashboard est utilisée par le propriétaire pour gérer ses annonces et réservations */}
                <Link to="/dashboard">Tableau de bord</Link> 
              </>
            )}

            {/* Liens pour la messagerie (pour les deux rôles) */}
            {/* Supposons une route pour la liste des conversations */}
            <Link to="/conversations">Messagerie</Link> 

            {/* Bouton de Déconnexion */}
            <button onClick={handleLogout} className="logout-button">
              Déconnexion
            </button>
          </>
        ) : (
          /* --- LIENS CONDITIONNELS : DÉCONNECTÉ --- */
          <>
            <Link to="/register">S'inscrire</Link>
            <Link to="/login" className="login-link">Se connecter</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;