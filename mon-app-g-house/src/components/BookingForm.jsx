import React, { useState, useEffect } from 'react';
// Import des hooks et composants Stripe
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { createBookingSession } from '../api/api';
import { useAuth } from '../context/AuthContext';
import './BookingForm.css';

// Options de style pour CardElement (pour un meilleur look)
const CARD_ELEMENT_OPTIONS = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
};

const BookingForm = ({ housingId, price, landlordId }) => {
    const { isLoggedIn, role } = useAuth();
    const stripe = useStripe();
    const elements = useElements();

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [totalPrice, setTotalPrice] = useState(0);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState(null);

    // --- Calcul du prix total ---
    useEffect(() => {
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // On calcule le prix uniquement pour des durées valides (> 0 jours)
            if (diffDays > 0) {
                // On suppose que le prix est par mois. Adapté pour une estimation journalière ici (pour simplifier).
                // Logique pour un prix mensuel : si la durée est > 30 jours, on applique le prix mensuel.
                // Pour cette démo simple, utilisons un prix par Nuit pour la clarté :
                const pricePerNight = price / 30; // Estimation simple
                const calculatedPrice = Math.round(pricePerNight * diffDays);
                setTotalPrice(calculatedPrice);
            } else {
                setTotalPrice(0);
            }
        }
    }, [startDate, endDate, price]);

    // --- Soumission du formulaire ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage('');
        
        if (!isLoggedIn) {
            setError("Veuillez vous connecter pour faire une réservation.");
            return;
        }

        if (role === 'landlord') {
            setError("Les propriétaires ne peuvent pas réserver leurs propres logements.");
            return;
        }

        if (totalPrice <= 0 || !startDate || !endDate || totalPrice > 500000) { // Limite anti-bug
            setError("Veuillez choisir des dates de réservation valides.");
            return;
        }

        if (!stripe || !elements) {
            // Stripe.js n'a pas encore chargé.
            return;
        }

        setLoading(true);

        try {
            // 1. Créer la session de paiement (Backend)
            // Le backend retourne la `sessionId` et la `clientSecret` pour le paiement.
            const sessionResponse = await createBookingSession(housingId, {
                startDate,
                endDate,
                totalPrice // Prix calculé
            });
            
            const { sessionId } = sessionResponse.data;

            // 2. Rediriger l'utilisateur vers la page de paiement Stripe
            const { error: stripeRedirectError } = await stripe.redirectToCheckout({
                sessionId: sessionId,
            });

            if (stripeRedirectError) {
                setError(stripeRedirectError.message || "Erreur lors de la redirection vers le paiement.");
            }

            // Note: Nous n'arrivons pas ici si la redirection réussit.
            setMessage("Redirection vers le paiement...");

        } catch (err) {
            console.error("Erreur lors de la création de la session de paiement:", err);
            setError(err.response?.data?.message || "Erreur de connexion à l'API de paiement.");
        } finally {
            setLoading(false);
        }
    };

    // --- Rendu ---
    if (!isLoggedIn || role === 'landlord') {
        return (
            <div className="booking-form-box not-allowed-box">
                {role === 'landlord' ? (
                    <p>Ceci est votre annonce. Consultez votre tableau de bord pour les réservations.</p>
                ) : (
                    <p>🔑 Veuillez vous <Link to="/login">connecter</Link> en tant que Locataire pour réserver ce logement.</p>
                )}
            </div>
        );
    }


    return (
        <div className="booking-form-box">
            <h2>Réserver maintenant</h2>
            
            <form onSubmit={handleSubmit}>
                <label>
                    Date de début:
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </label>
                
                <label>
                    Date de fin:
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </label>
                
                {/* Affichage du prix calculé */}
                {totalPrice > 0 && (
                    <p className="total-price">
                        Prix total estimé pour {Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} jours : 
                        <strong> {totalPrice.toFixed(2)} €</strong>
                    </p>
                )}

                {/* NOTE : Pour la session de paiement simple de Stripe, nous n'avons PAS besoin de CardElement ici, 
                   car nous redirigeons vers la page d'accueil de Stripe. Si vous utilisiez 
                   'Payment Intents' sans redirection, CardElement serait nécessaire. */}
                
                <button type="submit" disabled={loading || totalPrice <= 0}>
                    {loading ? 'Redirection...' : `Réserver et Payer ${totalPrice.toFixed(2)} €`}
                </button>
            </form>

            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}
        </div>
    );
};

export default BookingForm;