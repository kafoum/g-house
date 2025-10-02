import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// 🔑 Assurez-vous d'importer les fonctions de l'API REST
import { getMessages, getConversationDetails } from '../api/api'; 

// 🔑 URL pour le WebSocket (Utilisez VITE_WS_URL si vous l'avez défini, sinon l'URL de l'API Render)
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://g-house-api.onrender.com';

const Conversation = () => {
    const { id: conversationId } = useParams(); // ID de la conversation (depuis l'URL)
    const { user } = useAuth();
    
    const [conversation, setConversation] = useState(null); // Détails de la conversation
    const [messages, setMessages] = useState([]); 
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const ws = useRef(null); 
    const messagesEndRef = useRef(null); 

    // --- 1. CHARGEMENT INITIAL (Historique et Détails) ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // A. Récupération des messages existants (Historique)
                const messagesResponse = await getMessages(conversationId); 
                setMessages(messagesResponse.data.messages); 

                // B. Récupération des détails de la conversation (pour trouver l'autre participant)
                // Note : Vous devez ajouter getConversationDetails dans votre api.js si non existant.
                // Sinon, utilisez l'objet conversation de ConversationsList (si vous le passez via state/context)
                // Pour simplifier, on suppose que vous avez l'info :
                
                // Ici, on simule l'identification de l'autre participant
                // 💡 Vous devez adapter ceci pour récupérer le participant correctement
                const conversationDetails = {
                    participants: [
                        { _id: user.userId, name: user.name },
                        { _id: 'ID_AUTRE_PARTICIPANT', name: 'Nom Autre' } // À remplacer par l'ID réel
                    ]
                };
                setConversation(conversationDetails);
                
            } catch (err) {
                console.error("Erreur de chargement des données de conversation:", err);
                setError("Impossible de charger l'historique des messages.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
    // --- 2. GESTION DE LA CONNEXION WEBSOCKET ---
        const token = localStorage.getItem('token');
        if (!token) return;

        // Connexion au WebSocket avec le token
        ws.current = new WebSocket(`${WS_URL}/?token=${token}`);

        ws.current.onopen = () => {
            console.log("Connexion WebSocket établie.");
        };

        // 3. Réception des NOUVEAUX messages
        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // On s'assure que le message est bien pour cette conversation
            if (data.type === 'NEW_MESSAGE' && data.payload.conversation === conversationId) {
                // 🔑 Le message reçu (même celui que l'on vient d'envoyer) est ajouté à la liste
                setMessages(prevMessages => [...prevMessages, data.payload]);
            }
        };

        // ... (Gestion de close et error) ...
        
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [conversationId, user.userId]); 

    // --- 4. SCROLL AUTOMATIQUE ---
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]); 

    // --- 5. ENVOI DE MESSAGE ---
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN || !conversation) return;

        // 🔑 CLÉ : Trouver l'ID du destinataire parmi les participants
        const otherParticipant = conversation.participants.find(p => p._id !== user.userId);
        if (!otherParticipant) {
             console.error("Destinataire introuvable dans la conversation.");
             return;
        }

        const messagePayload = {
            type: 'SEND_MESSAGE',
            payload: {
                conversationId: conversationId,
                content: newMessage,
                recipientId: otherParticipant._id, // ID de la personne à qui envoyer
            }
        };

        ws.current.send(JSON.stringify(messagePayload));
        setNewMessage('');
    };

    if (loading) return <p className="text-center mt-10">Chargement des messages...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;

    return (
        <div className="container mx-auto p-4 flex flex-col h-[80vh]">
            <h2 className="text-2xl font-bold mb-4">Conversation avec {conversation ? conversation.participants.find(p => p._id !== user.userId)?.name : '...'}</h2>
            
            {/* Zone d'affichage des messages */}
            <div className="flex-1 overflow-y-auto p-4 border rounded-lg bg-gray-50 mb-4 space-y-3">
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500">Aucun message. Commencez la discussion !</p>
                ) : (
                    messages.map((msg, index) => (
                        <div 
                            key={index} 
                            className={`flex ${msg.sender?._id === user.userId ? 'justify-end' : 'justify-start'}`}
                        >
                            <div 
                                className={`max-w-xs px-4 py-2 rounded-xl ${
                                    msg.sender?._id === user.userId 
                                        ? 'bg-blue-600 text-white rounded-br-none' 
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
                    disabled={!newMessage.trim()}
                >
                    Envoyer
                </button>
            </form>
        </div>
    );
};

export default Conversation;