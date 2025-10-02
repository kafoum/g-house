import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Assurez-vous d'avoir une fonction getConversationDetails dans api/api.js, si elle n'existe pas, elle sera nécessaire.
import { getMessages, getConversationDetails } from '../api/api'; 
import { jwtDecode } from 'jwt-decode'; // Utile pour décoder le token si nécessaire, bien que useAuth doive le faire

// Configuration de l'URL WebSocket
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://g-house-api.onrender.com/api';
// Convertit l'URL REST (https://...) en URL WebSocket sécurisée (wss://...)
const WS_URL = API_BASE_URL.replace(/^https?:\/\//, 'wss://').replace(/\/api$/, '');

const Conversation = () => {
    const { id: conversationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth(); // Utilisateur connecté
    
    // États
    const [conversation, setConversation] = useState(null); 
    const [messages, setMessages] = useState([]); 
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Références pour le WebSocket et le défilement
    const ws = useRef(null); 
    const messagesEndRef = useRef(null); 

    // Données dérivées (Calculées à chaque rendu)
    const otherParticipant = conversation?.participants.find(p => p._id !== user?.userId); 
    const recipientId = otherParticipant?._id;
    const isWebSocketOpen = ws.current && ws.current.readyState === WebSocket.OPEN;

    // Fonction de défilement vers le bas
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // --------------------------------------------------------------------------
    // 1. GESTION DE LA CONNEXION ET RÉCUPÉRATION DE L'HISTORIQUE (useEffect principal)
    // --------------------------------------------------------------------------
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
            setError("Token d'authentification manquant.");
            setLoading(false);
            return;
        }
        
        // --- A. Récupération des données (Détails et Historique) ---
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Récupération de l'historique des messages
                const messagesResponse = await getMessages(conversationId); 
                // ✅ FIX CRITIQUE : Utilise response.data.messages pour le tableau des messages
                setMessages(messagesResponse.data.messages || []); 

                // 2. Récupération des détails de la conversation
                // Cela est essentiel pour identifier l'autre participant (recipientId)
                const convDetailsResponse = await getConversationDetails(conversationId);
                setConversation(convDetailsResponse.data.conversation || convDetailsResponse.data); 
                
            } catch (err) {
                console.error("Erreur de chargement de la conversation:", err);
                // Gérer spécifiquement le 404/403 si l'utilisateur n'a pas accès
                setError("Impossible de charger la conversation. Accès refusé ou conversation inexistante.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        // --- B. Initialisation du WebSocket ---
        const websocketUrl = `${WS_URL}?token=${token}`;
        ws.current = new WebSocket(websocketUrl);

        ws.current.onopen = () => {
            console.log(`[WS] Connecté pour la conversation: ${conversationId}`);
        };

        ws.current.onerror = (err) => {
            console.error("[WS] Erreur WebSocket:", err);
            // On peut définir un état d'erreur pour indiquer que le chat temps réel est HS
        };

        // --- C. Gestion des messages entrants (via WebSocket) ---
        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'NEW_MESSAGE' && data.payload.conversation === conversationId) {
                    // ✅ FIX CRITIQUE : Ajoute le message au state, peu importe si on est l'expéditeur ou le destinataire
                    setMessages(prevMessages => {
                        // S'assurer que le message n'est pas déjà dans la liste (pour éviter les doublons si le backend renvoie à l'expéditeur et que le front écoute)
                        if (prevMessages.some(msg => msg._id === data.payload._id)) {
                             return prevMessages; // Message déjà présent, ignorer
                        }
                        return [...prevMessages, data.payload];
                    });
                }
            } catch (e) {
                console.error("[WS] Erreur de parsing ou de gestion du message:", e);
            }
        };

        // --- D. Nettoyage (Fermeture de la connexion à l'unload) ---
        return () => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.close();
                console.log("[WS] Déconnecté.");
            }
        };
        
    }, [conversationId, user, navigate]); // Dépendances essentielles

    // --------------------------------------------------------------------------
    // 2. SCROLL AUTOMATIQUE (Déclenché à chaque nouvel ajout de message)
    // --------------------------------------------------------------------------
    useEffect(() => {
        scrollToBottom();
    }, [messages]);


    // --------------------------------------------------------------------------
    // 3. LOGIQUE D'ENVOI DU MESSAGE
    // --------------------------------------------------------------------------
    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (!newMessage.trim() || !isWebSocketOpen || !recipientId) {
            console.warn("Impossible d'envoyer: message vide, WS non ouvert ou destinataire inconnu.");
            return;
        }
        
        const messagePayload = {
            type: 'SEND_MESSAGE',
            payload: {
                conversationId: conversationId,
                content: newMessage.trim(),
                recipientId: recipientId, // ID de l'autre participant (le destinataire)
            }
        };
        
        // ✅ Envoi via WebSocket au backend (qui se charge de la sauvegarde et du renvoi)
        ws.current.send(JSON.stringify(messagePayload));
        setNewMessage('');
    };

    // --------------------------------------------------------------------------
    // 4. RENDU DU COMPOSANT
    // --------------------------------------------------------------------------

    if (loading) {
        return <p className="text-center mt-10">Chargement de la conversation...</p>;
    }

    if (error) {
        return <p className="text-center mt-10 text-red-600">Erreur : {error}</p>;
    }
    
    const pageTitle = otherParticipant 
        ? `Chat avec ${otherParticipant.name}` 
        : conversation?.housing?.title 
            ? `Conversation sur ${conversation.housing.title}`
            : 'Conversation';


    return (
        <div className="container mx-auto p-4 max-w-2xl h-[80vh] flex flex-col">
            
            <h2 className="text-2xl font-bold mb-4 text-gray-800 text-center">{pageTitle}</h2>
            
            {/* Indication de l'état du WebSocket */}
            {!isWebSocketOpen && (
                 <div className="text-center text-sm text-red-500 mb-2 p-1 bg-red-100 rounded">
                     Connexion au chat en temps réel (WebSocket) perdue ou en cours...
                 </div>
            )}

            {/* Zone des messages (scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 rounded-lg shadow-inner mb-4">
                
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500 mt-10">Démarrez la conversation !</p>
                ) : (
                    messages.map((msg, index) => (
                        <div 
                            key={msg._id || index} // Utiliser _id s'il est présent
                            className={`flex ${msg.sender?._id === user.userId ? 'justify-end' : 'justify-start'} mb-3`}
                        >
                            <div 
                                className={`max-w-xs lg:max-w-md p-3 text-white rounded-xl 
                                ${msg.sender?._id === user.userId 
                                    ? 'bg-blue-600 rounded-br-none' 
                                    : 'bg-gray-200 text-gray-800 rounded-tl-none'
                                } shadow-md`}
                            >
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-xs mt-1 ${msg.sender?._id === user.userId ? 'text-gray-200' : 'text-gray-500'} text-right`}>
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
            
            {/* Formulaire d'envoi */}
            <form onSubmit={handleSendMessage} className="flex p-2 bg-white border rounded-lg shadow">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="flex-1 border-none focus:ring-0 focus:outline-none p-2"
                />
                <button 
                    type="submit" 
                    className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    // Désactive le bouton si le message est vide OU si le WebSocket n'est pas ouvert
                    disabled={!newMessage.trim() || !isWebSocketOpen} 
                >
                    Envoyer
                </button>
            </form>
        </div>
    );
};

export default Conversation;