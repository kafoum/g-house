// Fichier : frontend/src/pages/ConversationsList.jsx (Version Corrigée)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { getConversationsList } from '../api/api'; 
import { useAuth } from '../context/AuthContext'; 

const ConversationsList = () => {
    const { user, isLoading: isAuthLoading } = useAuth(); // Récupère les infos de l'utilisateur connecté
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 🔑 CLÉ : Déterminer l'ID utilisateur pour la comparaison
    const currentUserId = user ? (user._id || user.userId) : null; 

    useEffect(() => {
        // Attendre que l'authentification soit chargée et que l'utilisateur soit connecté
        if (isAuthLoading) return;

        if (!user) {
            setLoading(false);
            setError('Vous devez être connecté pour voir vos conversations.');
            return;
        }
        
        const fetchConversations = async () => {
            setLoading(true);
            try {
                const response = await getConversationsList(); 
                setConversations(response.data.conversations);
            } catch (err) {
                setError('Impossible de charger les conversations. Veuillez réessayer plus tard.');
                console.error("Erreur API des conversations:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    // Déclenche le fetch quand l'objet 'user' du contexte est prêt ou change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isAuthLoading]); 

    if (loading || isAuthLoading) {
        return <p className="text-center mt-10 text-lg">Chargement des conversations...</p>;
    }

    if (error) {
        return <p className="text-center mt-10 text-xl text-red-600">⚠️ {error}</p>;
    }
    
    if (conversations.length === 0) {
        return <p className="text-center mt-10 text-xl text-gray-500">Vous n'avez pas encore de conversation.</p>
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Mes Conversations</h1>

            <ul className="bg-white rounded-lg shadow-xl overflow-hidden divide-y divide-gray-200">
                {conversations.map(conv => {
                    // 🔑 Utilise currentUserId sécurisé
                    const otherParticipant = conv.participants.find(p => p._id !== currentUserId); 
                    
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
                                {/* Optionnel : Afficher le dernier message */}
                                {conv.lastMessage?.content && (
                                    <p className="text-xs text-gray-400 truncate mt-1">
                                        Dernier message: {conv.lastMessage.content}
                                    </p>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ConversationsList;