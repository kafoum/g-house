import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token) {
      setIsLoggedIn(true);
      setUserRole(role);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setIsLoggedIn(false);
    setUserRole(null);
    navigate('/');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">G-House</Link>
      <div className="navbar-links">
        {isLoggedIn ? (
          <>
            {userRole === 'landlord' && (
              <Link to="/dashboard" className="nav-link">Tableau de bord</Link>
            )}
            <button onClick={handleLogout} className="nav-link logout-btn">Déconnexion</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Connexion</Link>
            <Link to="/register" className="nav-link">Inscription</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;