import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { jwtDecode } from 'jwt-decode';

const ConversationsList = () => {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decodedToken = jwtDecode(token);
                setUser(decodedToken);
                fetchConversations();
            } catch (err) {
                console.error("Token de connexion invalide", err);
                setError("La session a expiré. Veuillez vous reconnecter.");
                setLoading(false);
            }
        } else {
            setLoading(false);
            setError('Vous devez être connecté pour voir vos conversations.');
        }
    }, []);

    const fetchConversations = async () => {
        setLoading(true);
        try {
            const response = await api.get('/conversations');
            setConversations(response.data.conversations);
        } catch (err) {
            setError('Impossible de charger les conversations. Veuillez réessayer plus tard.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <p className="text-center text-lg mt-8 text-gray-600">Chargement des conversations...</p>;
    }

    if (error) {
        return <p className="text-center text-lg mt-8 text-red-500">{error}</p>;
    }

    if (conversations.length === 0) {
        return <p className="text-center text-lg mt-8 text-gray-500">Vous n'avez pas encore de conversations.</p>;
    }

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Mes Conversations</h2>
            <ul className="bg-white rounded-lg shadow-xl overflow-hidden divide-y divide-gray-200">
                {conversations.map(conv => {
                    const otherParticipant = conv.participants.find(p => p._id !== user.userId);
                    return (
                        <li key={conv._id}>
                            <Link
                                to={`/conversations/${conv._id}`}
                                className="block p-4 hover:bg-gray-50 transition-colors duration-200"
                            >
                                <div className="font-semibold text-lg text-gray-900">
                                    Conversation avec {otherParticipant ? otherParticipant.name : 'Utilisateur inconnu'}
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                    {conv.housing?.title || 'Logement non spécifié'}
                                </div>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ConversationsList;