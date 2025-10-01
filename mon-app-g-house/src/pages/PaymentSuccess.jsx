import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
// import { confirmBookingStatus } from '../api/api'; // Optionnel si l'on veut confirmer sur le frontend au cas où le webhook échoue

const PaymentSuccess = () => {
    const location = useLocation();
    const [message, setMessage] = useState("Vérification de la transaction...");
    
    // Stripe nous renvoie ici avec les paramètres d'URL `session_id` et `booking_id`
    const query = new URLSearchParams(location.search);
    const sessionId = query.get('session_id');
    const bookingId = query.get('booking_id'); 

    useEffect(() => {
        if (sessionId && bookingId) {
            // Le statut est géré de manière fiable par le Webhook (backend)
            // Ce frontend sert juste à informer l'utilisateur.
            setMessage("🎉 Paiement Réussi ! Votre réservation est en cours de confirmation.");
            
            // OPTIONNEL : Si vous voulez implémenter une vérification côté client
            // au cas où le webhook aurait été manqué:
            /*
            const confirmPayment = async () => {
                try {
                    // Cette route devrait appeler Stripe à nouveau pour s'assurer du statut
                    await confirmBookingStatus(sessionId, bookingId); 
                    setMessage("🎉 Paiement et Réservation Confirmés !");
                } catch (err) {
                    setMessage("⚠️ Paiement réussi, mais nous rencontrons un problème pour confirmer la réservation. Contactez le support.");
                    console.error("Erreur de confirmation finale:", err);
                }
            };
            confirmPayment();
            */
            
        } else {
            setMessage("⚠️ Erreur : Session de paiement introuvable.");
        }
    }, [sessionId, bookingId]);


    return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
            <h1>Statut de la Réservation</h1>
            <p style={{ fontSize: '1.2rem', margin: '20px 0' }}>{message}</p>
            
            {bookingId && (
                <div style={{ marginTop: '30px', border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
                    <p>Référence de la réservation : <strong>{bookingId}</strong></p>
                    <p>Nous vous enverrons une notification dès que le propriétaire aura pris connaissance de votre demande.</p>
                </div>
            )}
            
            <div style={{ marginTop: '50px' }}>
                <Link to="/" style={{ textDecoration: 'none', padding: '10px 20px', backgroundColor: '#007bff', color: 'white', borderRadius: '5px' }}>
                    Retourner à l'accueil
                </Link>
            </div>
        </div>
    );
};

export default PaymentSuccess;