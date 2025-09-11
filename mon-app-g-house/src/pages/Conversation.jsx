import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api/api";
import { jwtDecode } from "jwt-decode";
import io from "socket.io-client";

// L'URL de votre serveur WebSocket. Remplacez-la par votre URL de production si nécessaire.
const SOCKET_SERVER_URL = "http://localhost:5000";

const Conversation = () => {
    const { id } = useParams();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    const token = localStorage.getItem('token');
    let userId = null;
    if (token) {
        const decodedToken = jwtDecode(token);
        userId = decodedToken.userId;
    }

    // Référence au socket pour éviter les recréations multiples
    const socketRef = useRef(null);

    useEffect(() => {
        // Établit la connexion WebSocket
        socketRef.current = io(SOCKET_SERVER_URL);

        // Joint la conversation
        socketRef.current.emit("joinConversation", id);

        // Écoute les messages entrants
        socketRef.current.on("receiveMessage", (message) => {
            // Ajoute le nouveau message à l'état local
            setMessages((prevMessages) => [...prevMessages, message]);
        });

        // Nettoie l'écouteur et la connexion lorsque le composant est démonté
        return () => {
            socketRef.current.disconnect();
        };
    }, [id]);

    useEffect(() => {
        // Charge les messages initiaux via une requête HTTP classique
        fetchMessages();
    }, [id]);

    useEffect(() => {
        // Fait défiler jusqu'au dernier message
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/conversations/${id}/messages`);
            setMessages(response.data.messages);
        } catch (err) {
            setError('Impossible de charger les messages. Veuillez réessayer.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;

        try {
            // Émet le message via WebSocket au lieu de faire une requête HTTP
            const messageData = {
                conversationId: id,
                senderId: userId,
                content: newMessage,
            };
            socketRef.current.emit("sendMessage", messageData);

            setNewMessage('');
        } catch (err) {
            setError('Erreur lors de l\'envoi du message.');
            console.error(err);
        }
    };
    
    if (loading) return <p className="text-center text-lg mt-8 text-gray-600">Chargement des messages...</p>;
    if (error) return <p className="text-center text-lg mt-8 text-red-500">{error}</p>;
    
    return (
        <div className="container mx-auto p-4 flex flex-col h-full">
            <h2 className="text-3xl font-bold mb-6 text-gray-800">Conversation</h2>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100 rounded-lg shadow-inner mb-4 max-h-[70vh]">
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500">Aucun message dans cette conversation.</p>
                ) : (
                    messages.map(msg => (
                        <div key={msg._id} className={`flex ${msg.sender._id === userId ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-xs md:max-w-md lg:max-w-lg ${msg.sender._id === userId ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-800'}`}>
                                <strong className="block text-sm mb-1">{msg.sender.name}:</strong>
                                <p className="text-base break-words">{msg.content}</p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez un message..."
                    required
                    className="flex-1 p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors duration-200">
                    Envoyer
                </button>
            </form>
        </div>
    );
};

export default Conversation;