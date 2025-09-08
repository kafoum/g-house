import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ChatButton = ({ landlordId }) => {
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const handleStartConversation = async () => {
        if (!token) {
            alert('Vous devez être connecté pour envoyer un message.');
            navigate('/login');
            return;
        }

        try {
            const response = await axios.post('https://g-house-api.onrender.com/api/conversations/start',
                { recipientId: landlordId },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            // Redirige vers la conversation existante ou nouvelle
            navigate(`/conversations/${response.data.conversationId}`);
        } catch (error) {
            setMessage('Erreur lors du démarrage de la conversation.');
            console.error(error);
        }
    };

    return (
        <button onClick={handleStartConversation}>
            Envoyer un message au propriétaire
        </button>
    );
};

export default ChatButton;