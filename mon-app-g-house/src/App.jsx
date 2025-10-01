import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute'; // Assurez-vous d'avoir ce composant
import { AuthProvider } from './context/AuthContext'; // Assurez-vous d'avoir ce contexte

// 🔑 Importation des outils Stripe
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Lazy Load des pages
const HousingList = lazy(() => import('./pages/HousingList'));
const HousingDetails = lazy(() => import('./pages/HousingDetails'));
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const CreateHousing = lazy(() => import('./pages/CreateHousing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ConversationsList = lazy(() => import('./pages/ConversationsList'));
const Conversation = lazy(() => import('./pages/Conversation'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess')); // 🔑 Nouvelle page de succès

// Charger la clé Stripe publique (doit avoir le préfixe VITE_ si vous utilisez Vite)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* 🔑 Enveloppe tout le contenu avec Elements de Stripe */}
        <Elements stripe={stripePromise}>
          <div className="App">
            <Navbar />
            <Suspense fallback={<div>Chargement...</div>}>
              <Routes>
                
                {/* ROUTES PUBLIQUES */}
                <Route path="/" element={<HousingList />} />
                <Route path="/housing/:id" element={<HousingDetails />} />
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />
                <Route path="/success" element={<PaymentSuccess />} /> {/* 🔑 Route de succès paiement */}
                
                {/* ROUTES PROTÉGÉES (Nécessite uniquement d'être connecté) */}
                <Route element={<ProtectedRoute />}>
                    <Route path="/conversations" element={<ConversationsList />} /> 
                    <Route path="/conversations/:id" element={<Conversation />} /> 
                </Route>

                {/* ROUTES PROTÉGÉES (Rôle 'landlord' uniquement) */}
                <Route element={<ProtectedRoute allowedRole="landlord" />}>
                    <Route path="/create-housing" element={<CreateHousing />} />
                    <Route path="/dashboard" element={<Dashboard />} /> 
                    <Route path="/edit-housing/:id" element={<CreateHousing />} />
                </Route>
                
              </Routes>
            </Suspense>
          </div>
        </Elements>
      </AuthProvider>
    </Router>
  );
}

export default App;