import React from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ChatButton = ({ landlordId, housingId }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const handleStartConversation = async () => {
        if (!token) {
            alert('Vous devez être connecté pour envoyer un message.');
            navigate('/login');
            return;
        }

        try {
            const response = await axios.post(
                'https://g-house-api.onrender.com/api/conversations/start',
                { recipientId: landlordId, housingId: housingId }, // Ajout de housingId
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            navigate(`/conversations/${response.data.conversationId}`);
        } catch (error) {
            console.error("Erreur lors du démarrage de la conversation :", error);
            // Affichage d'une alerte plus conviviale en cas d'erreur
            alert('Une erreur est survenue lors du démarrage de la conversation. Veuillez réessayer.');
        }
    };

    return (
        <button
            onClick={handleStartConversation}
            className="bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors duration-300"
        >
            <i className="fas fa-comment-dots mr-2"></i>
            Envoyer un message au propriétaire
        </button>
    );
};

export default ChatButton;