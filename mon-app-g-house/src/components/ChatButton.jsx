import React from 'react';
import api from '../api/api';
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
            const response = await api.post('/conversations/start', { recipientId: landlordId, housingId });
            navigate(`/conversations/${response.data.conversationId}`);
        } catch (error) {
            console.error('Erreur lors du démarrage de la conversation:', error);
            alert('Erreur lors du démarrage de la conversation. Veuillez réessayer.');
        }
    };

    return (
        <button
            onClick={handleStartConversation}
            className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-blue-700 transition duration-300 ease-in-out"
        >
            Envoyer un message au propriétaire
        </button>
    );
};

export default ChatButton;
