import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
// 🔑 Importez le composant de protection
import ProtectedRoute from './components/ProtectedRoute'; 
import { AuthProvider } from './context/AuthContext'; 

// Import des pages
import HousingList from './pages/HousingList';
import HousingDetails from './pages/HousingDetails';
import Register from './pages/Register';
import Login from './pages/Login';
import CreateHousing from './pages/CreateHousing';
import Dashboard from './pages/Dashboard';
import ConversationsList from './pages/ConversationsList'; // Ajouté pour la messagerie
import Conversation from './pages/Conversation'; // Ajouté pour la messagerie

import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Navbar />
          <Routes>
            {/* --- ROUTES PUBLIQUES --- */}
            <Route path="/" element={<HousingList />} />
            <Route path="/housing/:id" element={<HousingDetails />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            
            {/* --- ROUTES PROTÉGÉES (Nécessite uniquement d'être connecté) --- */}
            {/* Ces routes utilisent ProtectedRoute sans 'allowedRole' spécifié */}
            <Route element={<ProtectedRoute />}>
                {/* Exemple de route nécessitant juste d'être connecté */}
                <Route path="/conversations" element={<ConversationsList />} /> 
                <Route path="/conversations/:id" element={<Conversation />} /> 
            </Route>

            {/* --- ROUTES PROTÉGÉES (Nécessite le rôle 'landlord') --- */}
            {/* Ces routes utilisent ProtectedRoute avec 'allowedRole="landlord"' */}
            <Route element={<ProtectedRoute allowedRole="landlord" />}>
                <Route path="/create-housing" element={<CreateHousing />} />
                <Route path="/dashboard" element={<Dashboard />} /> 
                <Route path="/edit-housing/:id" element={<CreateHousing />} />
            </Route>

            {/* Gestion des erreurs 404 / pages non trouvées (facultatif mais recommandé) */}
            {/* <Route path="*" element={<NotFound />} /> */}
            
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;