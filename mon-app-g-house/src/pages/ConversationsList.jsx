// Fichier : frontend/src/pages/ConversationsList.jsx (Réinitialisation du compteur)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getConversationsList } from '../api/api'; 
// 🔑 Importation de la fonction pour réinitialiser le compteur
import { useAuth } from '../context/AuthContext'; 

const ConversationsList = () => {
    // 🔑 NOUVEAU : Récupération de la fonction resetUnreadMessagesCount
    const { user, resetUnreadMessagesCount } = useAuth(); 
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
                const response = await getConversationsList(); 
                setConversations(response.data.conversations);
                
                // 🔑 CLÉ : Réinitialiser le compteur de messages non lus 
                resetUnreadMessagesCount(); 
                
            } catch (err) {
                setError('Impossible de charger les conversations. Veuillez réessayer plus tard.');
                console.error("Erreur API:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [user, resetUnreadMessagesCount]); 

    if (loading) {
        return <div className="p-8 text-center">Chargement des conversations...</div>;
    }
    // ... (Reste du rendu) ...
    // Le reste du composant (affichage de la liste) reste le même que dans votre fichier, 
    // mais le comportement d'urgence est maintenant géré par l'appel à resetUnreadMessagesCount.

    return (
        <div className="container mx-auto p-4 max-w-2xl">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Vos Messageries</h1>
            
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