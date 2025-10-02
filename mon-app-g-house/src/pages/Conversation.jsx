import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMessages, getConversationDetails } from '../api/api'; 
// Note : jwtDecode est optionnel ici car le token est directement passé à l'URL.
// import { jwtDecode } from 'jwt-decode'; 


// ====================================================================
// CONFIGURATION DE L'URL WEBSOCKET
// ====================================================================
// Récupère l'URL de base de l'API REST
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://g-house-api.onrender.com/api';

// Convertit l'URL REST (https://...) en URL WebSocket sécurisée (wss://...)
// et retire le suffixe '/api' si nécessaire.
const WS_URL = API_BASE_URL
    .replace(/^https?:\/\//, 'wss://') // Change http:// ou https:// en ws:// ou wss://
    .replace(/\/api$/, '');              // Supprime le '/api' final


const Conversation = () => {
    const { id: conversationId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth(); // Utilisateur connecté (contient .userId)
    
    // États
    const [conversation, setConversation] = useState(null); 
    const [messages, setMessages] = useState([]); 
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isWebSocketOpen, setIsWebSocketOpen] = useState(false); // État de la connexion WS
    
    // Références pour le WebSocket et le défilement
    const ws = useRef(null); 
    const messagesEndRef = useRef(null); 

    // Données dérivées (l'ID de l'autre participant pour l'affichage)
    const otherParticipant = conversation?.participants.find(p => p._id !== user?.userId);

    // ====================================================================
    // 1. CHARGEMENT INITIAL DES DONNÉES (REST)
    // ====================================================================

    useEffect(() => {
        if (!conversationId || !user) {
            setLoading(false);
            setError("ID de conversation ou informations utilisateur manquantes.");
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // Chargement des détails de la conversation
                const convResponse = await getConversationDetails(conversationId);
                setConversation(convResponse.data.conversation);

                // Chargement de l'historique des messages
                const msgResponse = await getMessages(conversationId);
                setMessages(msgResponse.data.messages || []);
                
            } catch (err) {
                setError('Impossible de charger la conversation ou les messages.');
                console.error("Erreur API lors du chargement de la conversation:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [conversationId, user, navigate]);


    // ====================================================================
    // 2. GESTION DE LA CONNEXION WEBSOCKET (REAL-TIME)
    // ====================================================================

    useEffect(() => {
        if (!user) return; 

        // 🔑 Récupération du token JWT pour l'authentification WebSocket
        const token = localStorage.getItem('token');
        if (!token) {
            setError("Token d'authentification manquant. Veuillez vous reconnecter.");
            return;
        }

        // 🔑 Connexion au WebSocket avec le token dans la query string
        const connectionUrl = `${WS_URL}?token=${token}`;
        ws.current = new WebSocket(connectionUrl);
        
        // --- Événements WebSocket ---
        
        ws.current.onopen = () => {
            console.log('WebSocket Connection Opened:', connectionUrl);
            setIsWebSocketOpen(true);
        };
        
        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // 🔑 Gérer la réception d'un nouveau message
                if (data.type === 'NEW_MESSAGE' && data.payload.conversation === conversationId) {
                    console.log("Nouveau message reçu:", data.payload);
                    
                    // Ajoute le nouveau message à la liste existante
                    setMessages(prevMessages => [...prevMessages, data.payload]);
                    
                } else if (data.type === 'ERROR') {
                    console.error("Erreur WS du serveur:", data.message);
                    // Afficher une alerte ou un message d'erreur à l'utilisateur
                }
            } catch (e) {
                console.error('Erreur de parsing JSON dans onmessage:', e);
            }
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket Error:', error);
            // Afficher une alerte ou un message d'erreur plus visible
        };

        ws.current.onclose = (event) => {
            console.log('WebSocket Connection Closed:', event.code, event.reason);
            setIsWebSocketOpen(false);
        };
        
        // 🔑 Fonction de nettoyage : Ferme la connexion WebSocket lors du démontage du composant
        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
                setIsWebSocketOpen(false);
            }
        };
    }, [user, conversationId]); // Se reconnecte si l'utilisateur ou la conversation change


    // ====================================================================
    // 3. GESTION DU DÉFILEMENT AUTOMATIQUE
    // ====================================================================

    // Se déclenche à chaque fois que la liste des messages change (nouveau message)
    useEffect(() => {
        // Défile vers le bas de la liste de messages
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]); 


    // ====================================================================
    // 4. GESTION DE L'ENVOI DE MESSAGE (WebSocket)
    // ====================================================================

    const handleSendMessage = (e) => {
        e.preventDefault();
        const content = newMessage.trim();

        if (!content || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
            return;
        }

        // 🔑 Structure du message à envoyer au serveur via WebSocket
        const messageToSend = {
            type: 'SEND_MESSAGE',
            payload: {
                conversationId,
                content: content,
            }
        };

        try {
            // Envoi de la donnée JSON
            ws.current.send(JSON.stringify(messageToSend));
            // Efface l'input, l'affichage se fera via l'écho du serveur dans onmessage
            setNewMessage('');
        } catch (error) {
            console.error('Erreur lors de l\'envoi via WS:', error);
            setError('Impossible d\'envoyer le message. Veuillez réessayer.');
        }
    };


    // ====================================================================
    // 5. RENDU DU COMPOSANT
    // ====================================================================

    if (loading) {
        return <div className="p-4 text-center">Chargement de la conversation...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-500">{error}</div>;
    }

    if (!conversation) {
        return <div className="p-4 text-center">Conversation introuvable.</div>;
    }

    return (
        <div className="flex flex-col h-[80vh] max-w-4xl mx-auto my-4 bg-gray-50 border rounded-xl shadow-lg">
            
            {/* Entête de la Conversation */}
            <div className="p-4 border-b bg-white rounded-t-xl">
                <h2 className="text-xl font-bold text-gray-800">
                    Chat avec {otherParticipant ? otherParticipant.name : 'Utilisateur inconnu'}
                </h2>
                <p className="text-sm text-gray-500">
                    Logement : {conversation.housing?.title || 'Non spécifié'}
                </p>
                <span className={`inline-block w-3 h-3 rounded-full ml-2 ${isWebSocketOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-xs text-gray-500 ml-1">
                    {isWebSocketOpen ? 'Connecté (temps réel)' : 'Déconnecté (reconnexion automatique en cours...)'}
                </span>
            </div>

            {/* Corps des Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500 italic">Démarrez la conversation !</p>
                ) : (
                    messages.map((msg) => (
                        // Détermine si le message est envoyé ou reçu
                        <div 
                            key={msg._id || msg.createdAt} // Utilise _id si disponible, sinon createdAt
                            className={`flex ${msg.sender?._id === user.userId ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-xs lg:max-w-md p-3 rounded-lg shadow-md ${
                                msg.sender?._id === user.userId 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white text-gray-800 rounded-tl-none border'
                            }`}>
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-xs mt-1 ${msg.sender?._id === user.userId ? 'text-gray-200' : 'text-gray-500'} text-right`}>
                                    {/* Affiche l'heure d'envoi */}
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                {/* 🔑 Référence pour le défilement automatique */}
                <div ref={messagesEndRef} />
            </div>
            
            {/* Formulaire d'envoi */}
            <form onSubmit={handleSendMessage} className="flex p-4 bg-white border-t rounded-b-xl">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="flex-1 border-gray-300 border focus:ring-blue-500 focus:border-blue-500 p-3 rounded-l-md focus:outline-none"
                    // Empêche d'écrire si le WS n'est pas ouvert ou si le chargement initial est en cours
                    disabled={!isWebSocketOpen || loading} 
                />
                <button 
                    type="submit" 
                    className="ml-0 px-6 py-3 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 transition disabled:opacity-50"
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