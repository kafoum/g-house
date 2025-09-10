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
        if (!token) {
            setError("Vous n'êtes pas connecté.");
            setLoading(false);
            return;
        }
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

    if (loading) return <p className="text-center text-gray-500">Chargement des conversations...</p>;
    if (error) return <p className="text-center text-red-500">{error}</p>;
    if (conversations.length === 0) return <p className="text-center text-gray-500">Vous n'avez pas encore de conversations.</p>;

    return (
        <div className="p-4 md:p-8 max-w-lg mx-auto bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-center">Mes Conversations</h2>
            <ul className="space-y-2">
                {conversations.map(conv => {
                    const otherParticipant = conv.participants.find(p => p._id !== user.id);
                    const displayName = otherParticipant ? otherParticipant.name : 'Utilisateur inconnu';
                    return (
                        <li key={conv._id}>
                            <Link to={`/conversations/${conv._id}`} className="block p-3 border rounded-lg hover:bg-gray-100 transition-colors duration-200">
                                Conversation avec <span className="font-semibold">{displayName}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ConversationsList;