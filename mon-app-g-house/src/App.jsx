import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import HousingList from './pages/HousingList';
import HousingDetail from './pages/HousingDetail';
import CreateHousing from './pages/CreateHousing';
import EditHousing from './pages/EditHousing'; // Import du composant de modification
import ConversationsList from './pages/ConversationsList'; // Import de la liste de conversations
import Conversation from './pages/Conversation'; // Import de la page de conversation
import './App.css';

const App = () => {
  const [authToken, setAuthToken] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    if (token && user) {
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
        {userRole === 'landlord' && (
          <Link to="/housing/create">Créer une annonce</Link>
        )}
        {authToken && (
          <Link to="/conversations">Messages</Link>
        )}
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
          <Route path="/login" element={<Login setAuthToken={setAuthToken} />} />
          <Route path="/housing" element={<HousingList />} />
          <Route path="/housing/:id" element={<HousingDetail />} />
          <Route path="/housing/create" element={userRole === 'landlord' ? <CreateHousing /> : <Navigate to="/login" />} />
          <Route path="/housing/edit/:id" element={userRole === 'landlord' ? <EditHousing /> : <Navigate to="/login" />} />
          <Route path="/conversations" element={authToken ? <ConversationsList /> : <Navigate to="/login" />} />
          <Route path="/conversations/:id" element={authToken ? <Conversation /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </Router>
  );
};

export default App;