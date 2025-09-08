import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import HousingList from './pages/HousingList';
import HousingDetail from './pages/HousingDetail';
import CreateHousing from './pages/CreateHousing';
import ConversationsList from './pages/ConversationsList';
import Conversation from './pages/Conversation';
import UpdateHousing from './pages/UpdateHousing';
import ManageHousing from './pages/ManageHousing';
import './App.css';

const App = () => {
  const [authToken, setAuthToken] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    // Récupère les informations de l'utilisateur stockées localement
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (token && user && user.role) {
      setAuthToken(token);
      setUserRole(user.role);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthToken(null);
    setUserRole(null);
  };

  return (
    <Router>
      <nav>
        <Link to="/">Accueil</Link>
        <Link to="/housing">Logements</Link>
        {/* Afficher ces liens uniquement pour les propriétaires connectés */}
        {userRole === 'landlord' && (
          <>
            <Link to="/housing/create">Créer une annonce</Link>
            <Link to="/manage-housing">Gérer mes annonces</Link>
          </>
        )}
        {/* Afficher ce lien uniquement si l'utilisateur est connecté */}
        {authToken && (
          <Link to="/conversations">Messages</Link>
        )}
        {/* Afficher les liens de connexion/déconnexion selon l'état d'authentification */}
        {!authToken ? (
          <>
            <Link to="/login">Connexion</Link>
            <Link to="/register">Inscription</Link>
          </>
        ) : (
          <button onClick={handleLogout}>Déconnexion</button>
        )}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Home authToken={authToken} />} />
          <Route path="/register" element={<Register />} />
          {/* Passer setAuthToken et setUserRole au composant Login */}
          <Route path="/login" element={<Login setAuthToken={setAuthToken} setUserRole={setUserRole} />} />
          <Route path="/housing" element={<HousingList />} />
          <Route path="/housing/:id" element={<HousingDetail />} />
          
          {/* Routes protégées pour les propriétaires */}
          <Route 
            path="/housing/create" 
            element={userRole === 'landlord' ? <CreateHousing /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/manage-housing" 
            element={userRole === 'landlord' ? <ManageHousing /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/update-housing/:id" 
            element={userRole === 'landlord' ? <UpdateHousing /> : <Navigate to="/login" />} 
          />

          {/* Routes protégées pour les utilisateurs authentifiés */}
          <Route 
            path="/conversations" 
            element={authToken ? <ConversationsList /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/conversations/:id" 
            element={authToken ? <Conversation /> : <Navigate to="/login" />} 
          />
        </Routes>
      </main>
    </Router>
  );
};

export default App;
