import React, { useState, useEffect } from 'react';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// 🔑 L'importation manquante qui corrige l'erreur Vercel
import { createPaymentSession } from '../api/api'; 

// --- Fonctions utilitaires de calcul ---

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
    // Hooks Stripe nécessaires pour la redirection
    const stripe = useStripe(); 
    const elements = useElements();
    const navigate = useNavigate();
    const { user } = useAuth(); // Pour vérifier l'authentification et le rôle
    
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalPrice, setTotalPrice] = useState(0);

    // Mettre à jour le prix total lorsque les dates changent
    useEffect(() => {
        const days = calculateTotalDays(startDate, endDate);
        setTotalPrice(calculateTotalPrice(price, days));
    }, [startDate, endDate, price]);

    // Validation du formulaire et statut utilisateur
    const isFormValid = startDate && endDate && new Date(endDate) > new Date(startDate) && totalPrice > 0;
    const isLandlord = user && user.userId === landlordId;
    const isAuthenticated = !!user;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Vérification de la validité de Stripe/Formulaire/Authentification
        if (!stripe || !elements || !isFormValid) {
            return;
        }

        if (!isAuthenticated) {
            setError("Veuillez vous connecter pour effectuer une réservation.");
            return;
        }

        setLoading(true);

        const bookingData = {
            housingId,
            startDate,
            endDate,
            totalAmount: totalPrice, // Le backend revalidera le prix
        };

        try {
            // 1. Appel à l'API pour créer la session de paiement Stripe
            const response = await createBookingSession(bookingData);
            const { sessionId } = response.data;

            // 2. Redirection vers la page de paiement Stripe
            const result = await stripe.redirectToCheckout({
                sessionId: sessionId,
            });

            if (result.error) {
                setError(result.error.message || 'Échec de la redirection vers le paiement.');
            }

        } catch (err) {
            console.error("Erreur API de réservation:", err);
            // Afficher le message d'erreur du backend (ex: dates déjà prises)
            setError(err.response?.data?.message || 'Erreur lors de la création de la session de paiement. Vérifiez les dates.');
        } finally {
            setLoading(false);
        }
    };

    if (isLandlord) {
        return <p className="text-xl font-bold text-red-500 p-4">Vous êtes le propriétaire de cette annonce et ne pouvez pas la réserver.</p>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm mx-auto my-8">
            <h3 className="text-2xl font-semibold mb-4 text-gray-800">Réserver ce logement</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="start" className="block text-sm font-medium text-gray-700">Date d'arrivée</label>
                    <input
                        type="date"
                        id="start"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label htmlFor="end" className="block text-sm font-medium text-gray-700">Date de départ</label>
                    <input
                        type="date"
                        id="end"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        // La date de fin doit être au moins 1 jour après la date de début
                        min={startDate ? new Date(new Date(startDate).getTime() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                        required
                        disabled={!startDate}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                
                {totalPrice > 0 && (
                    <div className="text-lg font-bold text-gray-800 pt-2 border-t border-gray-200">
                        Total estimé ({calculateTotalDays(startDate, endDate)} jours): <span className="text-indigo-600">{totalPrice} €</span>
                        <p className="text-xs font-normal text-gray-500 mt-1">
                            (Basé sur {price}€/mois. Le prix final est calculé et validé par notre serveur.)
                        </p>
                    </div>
                )}


                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                
                <button
                    type="submit"
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