import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// 🔑 Importation de la fonction d'API
import { getConversationsList } from '../api/api';
// 🔑 Importation du contexte d'authentification
import { useAuth } from '../context/AuthContext'; 

const ConversationsList = () => {
    const { user } = useAuth(); // 🔑 Récupère les infos de l'utilisateur connecté (ID, name, role, etc.)
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            setError('Vous devez être connecté pour voir vos conversations.');
            return;
        }
        
        const fetchConversations = async () => {
            setLoading(true);
            try {
                // 🔑 Appel à la fonction centralisée de l'API
                const response = await getConversationsList(); 
                setConversations(response.data.conversations);
            } catch (err) {
                setError('Impossible de charger les conversations. Veuillez réessayer plus tard.');
                console.error("Erreur API:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [user]); // Déclenche le fetch quand l'objet 'user' du contexte est prêt

    if (loading) {
        return <p className="text-center mt-10">Chargement des conversations...</p>;
    }

    if (error) {
        return <p className="text-center mt-10 text-red-500">{error}</p>;
    }
    
    if (conversations.length === 0) {
        return <p className="text-center text-lg mt-8 text-gray-500">Vous n'avez pas encore de conversations.</p>;
    }

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Mes Conversations</h2>
            <ul className="bg-white rounded-lg shadow-xl overflow-hidden divide-y divide-gray-200">
                {conversations.map(conv => {
                    // On cherche l'autre participant
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
                                    Logement: {conv.housing?.title || 'Non spécifié'}
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