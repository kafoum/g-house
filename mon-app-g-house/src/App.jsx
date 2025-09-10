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
        <nav className="bg-white shadow-lg p-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
                <Link to="/" className="text-xl font-bold text-blue-600 hover:text-blue-800 transition-colors duration-200">
                    G-House
                </Link>
                <Link to="/housing" className="text-gray-700 hover:text-blue-600 transition-colors duration-200">
                    Logements
                </Link>
                {userRole === 'landlord' && (
                    <>
                        <Link to="/housing/create" className="text-gray-700 hover:text-blue-600 transition-colors duration-200">
                            Créer une annonce
                        </Link>
                        <Link to="/manage-housing" className="text-gray-700 hover:text-blue-600 transition-colors duration-200">
                            Gérer mes annonces
                        </Link>
                    </>
                )}
            </div>
            <div className="flex items-center space-x-4">
                {authToken && (
                    <Link to="/conversations" className="text-gray-700 hover:text-blue-600 transition-colors duration-200">
                        Messages
                    </Link>
                )}
                {!authToken ? (
                    <>
                        <Link to="/login" className="bg-blue-500 text-white font-semibold py-2 px-4 rounded-full hover:bg-blue-600 transition-colors duration-200">
                            Connexion
                        </Link>
                        <Link to="/register" className="bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-full hover:bg-gray-300 transition-colors duration-200">
                            Inscription
                        </Link>
                    </>
                ) : (
                    <button 
                        onClick={handleLogout} 
                        className="bg-red-500 text-white font-semibold py-2 px-4 rounded-full hover:bg-red-600 transition-colors duration-200"
                    >
                        Déconnexion
                    </button>
                )}
            </div>
        </nav>
        <main className="container mx-auto mt-8 p-4">
            <Routes>
                <Route path="/" element={<Home authToken={authToken} />} />
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login setAuthToken={setAuthToken} setUserRole={setUserRole} />} />
                <Route path="/housing" element={<HousingList />} />
                <Route path="/housing/:id" element={<HousingDetail />} />
                
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
