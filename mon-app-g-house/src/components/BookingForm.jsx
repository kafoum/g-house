// Fichier : frontend/src/components/BookingForm.jsx (Mise à jour pour la redirection Stripe)

import React, { useState, useEffect } from 'react';
// useStripe et useElements ne sont pas nécessaires pour Stripe Checkout (redirection), mais peuvent rester importés si la configuration initiale l'exige.
// import { useStripe, useElements } from '@stripe/react-stripe-js'; 
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// 🔑 Importation de la fonction d'API pour créer la session de paiement
import { createBookingSession } from '../api/api'; 

// --- Fonctions utilitaires de calcul (à conserver) ---

// Calcule le nombre de jours entre deux dates (inclusif/exclusif)
const calculateTotalDays = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (startDate && endDate && endDate > startDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        // Jours pleins (arrondi au jour supérieur)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays;
    }
    return 0;
};

// Calcule le prix total basé sur le prix mensuel et le nombre de jours
const calculateTotalPrice = (pricePerMonth, days) => {
    if (days <= 0 || !pricePerMonth) return 0;
    // Approximation journalière (prix mensuel / 30 jours)
    const pricePerDay = pricePerMonth / 30.0; 
    // Arrondi à deux décimales pour l'affichage
    return (pricePerDay * days).toFixed(2); 
};


const BookingForm = ({ housingId, price, landlordId }) => {
    const { isLoggedIn } = useAuth();
    const navigate = useNavigate();
    
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // États dérivés
    const totalDays = calculateTotalDays(startDate, endDate);
    const totalPrice = calculateTotalPrice(price, totalDays);
    const isFormValid = totalDays > 0 && !!startDate && !!endDate;
    const isAuthenticated = isLoggedIn;

    // --- LOGIQUE DE SOUMISSION CLÉ ---
    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        
        if (!isFormValid) {
            setError("Veuillez choisir des dates valides (la date de fin doit être postérieure à la date de début).");
            return;
        }

        if (!isAuthenticated) {
            // Redirige l'utilisateur vers la page de connexion s'il n'est pas connecté
            navigate('/login');
            return;
        }

        setLoading(true);

        const bookingData = {
            housingId,
            startDate,
            endDate
            // Le backend gère le calcul du montant, le tenantId (via le JWT) et la création de la Booking
        };

        try {
            // 1. Appeler le backend pour créer la session Stripe Checkout
            const response = await createBookingSession(bookingData);
            
            // 2. Le backend renvoie l'URL de la session Stripe
            const { checkoutUrl } = response.data; 

            // 3. Rediriger l'utilisateur vers la page de paiement Stripe
            window.location.href = checkoutUrl;

        } catch (err) {
            setLoading(false);
            const errorMsg = err.response?.data?.message || 'Erreur inconnue lors de la création de la session de paiement.';
            setError(errorMsg);
            console.error("Erreur de session de paiement:", err);
        }
    };
    // ----------------------------------


    return (
        <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-indigo-500">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Réservation et Paiement</h2>
            
            {!isAuthenticated && (
                <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500">
                    <p>⚠️ Vous devez être connecté pour effectuer une réservation.</p>
                </div>
            )}
            
            <form onSubmit={handleBookingSubmit} className="space-y-4">
                {/* Champs de Date */}
                <div className="date-group space-y-3">
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Date de début de location</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Date de fin de location</label>
                        <input
                            type="date"
                            id="endDate"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                </div>
                
                {/* Affichage du prix total estimé */}
                {totalPrice > 0 && (
                    <div className="text-lg font-bold text-gray-800 pt-2 border-t border-gray-200">
                        Total estimé ({totalDays} jours): <span className="text-indigo-600">{totalPrice} €</span>
                        <p className="text-xs font-normal text-gray-500 mt-1">
                            (Basé sur {price}€/mois. Le prix final est calculé et validé par notre serveur.)
                        </p>
                    </div>
                )}


                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                
                <button
                    type="submit"
                    // Désactivé si en chargement, formulaire invalide, ou utilisateur non connecté
                    disabled={loading || !isFormValid || !isAuthenticated}
                    className={`w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        loading || !isFormValid || !isAuthenticated
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                    }`}
                >
                    {loading ? 'Redirection en cours...' : !isAuthenticated ? 'Se connecter pour réserver' : 'Réserver et Payer'}
                </button>
            </form>
        </div>
    );
};

export default BookingForm;