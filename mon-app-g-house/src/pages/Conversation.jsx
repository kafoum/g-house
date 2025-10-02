// Fichier : frontend/src/pages/Conversation.jsx (Version Corrigée)

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMessages, getConversationDetails } from '../api/api'; 

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
    const [isWebSocketOpen, setIsWebSocketOpen] = useState(false); // État du WS
    
    // Références pour le WebSocket et le défilement
    const ws = useRef(null); 
    const messagesEndRef = useRef(null); 

    // 🔑 CLÉ : Sécuriser la détermination de l'ID utilisateur (pour le style des messages)
    const currentUserId = user ? (user._id || user.userId) : null; 
    
    // Fonction de défilement vers le bas
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // --- 1. Fetch des messages et connexion WebSocket (useEffect) ---
    useEffect(() => {
        if (!currentUserId) {
            setError("Vous devez être connecté pour accéder à cette conversation.");
            setLoading(false);
            return;
        }

        // Fetch des données initiales (conversation et messages)
        const fetchInitialData = async () => {
            try {
                const [convResponse, msgResponse] = await Promise.all([
                    getConversationDetails(conversationId),
                    getMessages(conversationId)
                ]);
                setConversation(convResponse.data.conversation);
                setMessages(msgResponse.data.messages);
                // Le scroll est fait après l'établissement du WebSocket pour s'assurer que le DOM est prêt
            } catch (err) {
                console.error("Erreur de chargement des données:", err);
                setError("Impossible de charger la conversation.");
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();

        // Initialisation du WebSocket
        // 🔑 NOTE: Le token JWT doit être inclus pour l'authentification WebSocket (voir index.js backend)
        const token = localStorage.getItem('token');
        const websocket = new WebSocket(`${WS_URL}?token=${token}`);
        ws.current = websocket;

        websocket.onopen = () => {
            console.log('WebSocket connecté.');
            setIsWebSocketOpen(true);
            scrollToBottom(); // Scroll initial
        };

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'NEW_MESSAGE') {
                // 🔑 Le message reçu inclut l'objet sender. Il suffit d'ajouter le message
                setMessages((prevMessages) => [...prevMessages, data.payload]);
            }
        };

        websocket.onclose = () => {
            console.log('WebSocket déconnecté.');
            setIsWebSocketOpen(false);
        };

        websocket.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
            setError("Problème de connexion en temps réel.");
        };

        // Fonction de nettoyage (cleanup)
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId, currentUserId]); 

    // Scroll vers le bas à chaque nouveau message
    useEffect(scrollToBottom, [messages]); 


    // --- 2. Envoi du message (Logique de soumission) ---
    const handleSendMessage = (e) => {
        e.preventDefault();
        
        if (!newMessage.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
            return;
        }

        const messagePayload = {
            type: 'SEND_MESSAGE',
            conversationId,
            content: newMessage,
        };

        try {
            // Envoi via WebSocket
            ws.current.send(JSON.stringify(messagePayload));
            setNewMessage(''); // Réinitialise l'input
            // Le message sera ajouté à l'état `messages` via le `websocket.onmessage` (pour garantir l'uniformité)
            
        } catch (err) {
            console.error("Erreur d'envoi du message:", err);
            setError("Impossible d'envoyer le message.");
        }
    };
    
    // --- Rendu ---
    
    if (loading) {
        return <p className="text-center mt-10 text-lg">Chargement de la conversation...</p>;
    }

    if (error) {
        return <p className="text-center mt-10 text-xl text-red-600">⚠️ {error}</p>;
    }

    const otherParticipant = conversation?.participants.find(p => p._id !== currentUserId);

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto border rounded-lg shadow-lg">
            
            {/* Entête */}
            <div className="p-4 bg-indigo-600 text-white rounded-t-lg">
                <h2 className="text-xl font-bold">
                    Chat avec {otherParticipant ? otherParticipant.name : 'Utilisateur inconnu'}
                </h2>
                <p className="text-sm">
                    Logement: {conversation?.housing?.title || 'Non spécifié'}
                </p>
                {!isWebSocketOpen && (
                     <p className="text-xs text-red-200 mt-1">
                        Connexion en temps réel perdue. Actualisez la page.
                    </p>
                )}
            </div>
            
            {/* Zone des messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" style={{ maxHeight: '80vh' }}>
                {messages.map((msg) => (
                    <div 
                        key={msg._id || msg.createdAt} // Utiliser createdAt comme fallback si _id n'est pas dispo immédiatement
                        className={`flex ${msg.sender?._id === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                        <div 
                            className={`max-w-xs md:max-w-md p-3 rounded-lg shadow-md ${
                                msg.sender?._id === currentUserId 
                                    ? 'bg-indigo-600 text-white' 
                                    : 'bg-white text-gray-800 border'
                            }`}
                        >
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.sender?._id === currentUserId ? 'text-gray-200' : 'text-gray-500'} text-right`}>
                                {new Date(msg.createdAt).toLocaleTimeString()}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            
            {/* Formulaire d'envoi */}
            <form onSubmit={handleSendMessage} className="flex p-2 bg-white border-t rounded-b-lg">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="flex-1 border-none focus:ring-0 focus:outline-none p-2"
                />
                <button 
                    type="submit" 
                    className="ml-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
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