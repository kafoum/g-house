// Fichier : frontend/src/components/ChatButton.jsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// 🔑 Importation de la fonction d'API startConversation
import { startConversation } from '../api/api'; 

/**
 * Bouton pour démarrer une conversation avec le propriétaire d'une annonce.
 * @param {string} recipientId - L'ID de l'utilisateur avec qui chatter (le propriétaire).
 * @param {string} housingId - L'ID du logement concerné.
 * @param {string} subject - Le sujet de la conversation (pour l'affichage/log).
 */
const ChatButton = ({ recipientId, housingId, subject }) => {
    const { user, isLoggedIn } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleChatClick = async () => {
        setLoading(true);
        
        // 1. Vérification de la connexion
        if (!isLoggedIn) {
            alert("Vous devez être connecté pour contacter le propriétaire.");
            navigate('/login');
            return;
        }

        // 2. Vérification des données (C'est la cause de l'erreur 400)
        if (!housingId || !recipientId) {
            console.error("Erreur de données: housingId ou recipientId est manquant.");
            alert("Impossible de démarrer la conversation. Données d'annonce ou de propriétaire manquantes.");
            setLoading(false);
            return;
        }
        
        // 3. Empêcher de chatter avec soi-même (sécurité côté frontend)
        if (user.userId === recipientId) {
            alert("Vous ne pouvez pas démarrer une conversation sur votre propre annonce.");
            setLoading(false);
            return;
        }
        
        try {
            // 🔑 4. Appel API avec les IDs nécessaires
            const response = await startConversation(housingId, recipientId);
            
            const conversationId = response.data.conversation._id;
            
            // 5. Redirection vers la conversation
            navigate(`/conversations/${conversationId}`);

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Erreur inconnue lors du démarrage de la conversation.';
            console.error(`Erreur lors du démarrage de la conversation (${subject}):`, error);
            alert(`Erreur: ${errorMessage}`);

        } finally {
            setLoading(false);
        }
    };

    // Le bouton n'est affiché que si l'utilisateur est connecté ET qu'il n'est pas le destinataire
    if (!isLoggedIn || user.userId === recipientId) {
        return null; 
    }

    return (
        <button 
            onClick={handleChatClick}
            disabled={loading}
            className="w-full bg-indigo-600 text-white p-3 rounded-md hover:bg-indigo-700 transition duration-150 mt-4 text-lg"
        >
            {loading ? 'Démarrage du chat...' : 'Contacter le propriétaire'}
        </button>
    );
};

export default ChatButton;