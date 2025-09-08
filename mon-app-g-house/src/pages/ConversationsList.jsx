import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const ConversationsList = () => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const response = await axios.get('https://g-house-api.onrender.com/api/conversations', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setConversations(response.data.conversations);
        } catch (err) {
            setError('Impossible de charger les conversations. Veuillez réessayer plus tard.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const user = JSON.parse(localStorage.getItem('user'));

    if (loading) return <p>Chargement des conversations...</p>;
    if (error) return <p className="error">{error}</p>;
    if (conversations.length === 0) return <p>Vous n'avez pas encore de conversations.</p>;

    return (
        <div>
            <h2>Mes Conversations</h2>
            <ul>
                {conversations.map(conv => {
                    // Trouver le nom de l'autre participant
                    const otherParticipant = conv.participants.find(p => p._id !== user.id);
                    return (
                        <li key={conv._id}>
                            <Link to={`/conversations/${conv._id}`}>
                                Conversation avec {otherParticipant ? otherParticipant.name : 'Utilisateur inconnu'}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ConversationsList;