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
import { jwtDecode } from 'jwt-decode';
import './App.css';

const App = () => {
    const [authToken, setAuthToken] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userName, setUserName] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decodedToken = jwtDecode(token);
                setAuthToken(token);
                setUserRole(decodedToken.role);
                setUserName(decodedToken.name);
            } catch (error) {
                console.error("Invalid login token", error);
                handleLogout();
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthToken(null);
        setUserRole(null);
        setUserName(null);
    };

    return (
        <Router>
            <nav className="bg-white shadow-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link to="/" className="text-xl font-bold text-blue-600 hover:text-blue-800 transition duration-300">
                        G-House
                    </Link>
                    <Link to="/housing" className="text-gray-600 hover:text-blue-600 transition duration-300">
                        Logements
                    </Link>
                    {authToken && (
                        <Link to="/conversations" className="text-gray-600 hover:text-blue-600 transition duration-300">
                            Messagerie
                        </Link>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    {authToken ? (
                        <>
                            <span className="text-gray-700 font-medium"> Bienvenue, {userName || 'Utilisateur'} </span>
                            {userRole === 'landlord' && (
                                <Link to="/manage-housing" className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors duration-300">
                                    Gérer mes annonces
                                </Link>
                            )}
                            <button onClick={handleLogout} className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors duration-300">
                                Déconnexion
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-gray-600 hover:text-blue-600 transition duration-300">
                                Connexion
                            </Link>
                            <Link to="/register" className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-300">
                                Inscription
                            </Link>
                        </>
                    )}
                </div>
            </nav>
            <main className="container mx-auto py-8">
                <Routes>
                    <Route path="/" element={<Home authToken={authToken} userRole={userRole} userName={userName} />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login setAuthToken={setAuthToken} setUserRole={setUserRole} setUserName={setUserName} />} />
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