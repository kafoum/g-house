import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// ✅ CORRECTION : Importation du nom de fonction correct
import { getConversations } from '../api/api';
// 🔑 Importation du contexte d'authentification
import { useAuth } from '../context/AuthContext'; 

const ConversationsList = () => {
    const { user } = useAuth(); // 🔑 Récupère les infos de l'utilisateur connecté (ID, name, role, etc.)
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Le user du contexte d'Auth contient l'ID dans le champ `user.id` ou `user.userId`
        // Nous allons utiliser `user.userId` pour la recherche de participant.
        if (!user) {
            setLoading(false);
            setError('Vous devez être connecté pour voir vos conversations.');
            return;
        }
        
        const fetchConversations = async () => {
            setLoading(true);
            try {
                // ✅ CORRECTION : Utilisation de la fonction d'API `getConversations`
                const response = await getConversations(); 
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
        return <p className="text-center mt-10 text-red-600 font-semibold">{error}</p>;
    }
    
    if (conversations.length === 0) {
        return <p className="text-center text-lg mt-8 text-gray-500">Vous n'avez pas encore de conversations.</p>;
    }

    return (
        <div className="container mx-auto p-4">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Mes Conversations</h2>
            <ul className="bg-white rounded-lg shadow-xl overflow-hidden divide-y divide-gray-200">
                {conversations.map(conv => {
                    // Pour la conversation, on cherche l'autre participant (car `user.id` est l'ID du connecté)
                    // Note: Le contexte Auth renvoie l'ID dans `user.id` (ou `user.userId` selon la structure que vous avez gardée)
                    // J'utilise ici `user.id` pour la cohérence avec les autres fichiers. Si ça ne marche pas, utilisez `user._id` ou `user.userId`.
                    const currentUserId = user.id || user._id; // Tentative de compatibilité
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
                                    {/* Affiche l'objet lié si présent dans la conversation, sinon un placeholder */}
                                    Logement: {conv.housing?.title || 'Non spécifié'} 
                                </div>
                                {/* Affichage du dernier message pour le contexte (optionnel) */}
                                {conv.lastMessage && (
                                    <div className="text-xs text-gray-400 mt-1 truncate">
                                        Dernier message : {conv.lastMessage.content}
                                    </div>
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