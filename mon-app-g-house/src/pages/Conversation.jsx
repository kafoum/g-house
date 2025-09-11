import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const Conversation = () => {
    const { id } = useParams();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user, setUser] = useState(null);
    const [conversation, setConversation] = useState(null);
    const ws = useRef(null);
    const messagesEndRef = useRef(null);

    // Fonction pour scroller en bas des messages
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decodedToken = jwtDecode(token);
                setUser(decodedToken);
            } catch (err) {
                console.error("Invalid token:", err);
            }
        }
        
        // Obtenir l'URL de l'API, en gérant le cas où elle n'est pas définie
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        // Initialisation de la connexion WebSocket
        // Assurez-vous d'utiliser 'ws://' ou 'wss://' selon votre environnement
        const WS_URL = API_URL.startsWith('https') ? API_URL.replace('https', 'wss') : API_URL.replace('http', 'ws');
        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            console.log('Connexion WebSocket établie.');
            // Envoyer le token d'authentification
            ws.current.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
                // Ajouter le nouveau message à l'état local
                setMessages(prevMessages => [...prevMessages, data.message]);
            }
        };

        ws.current.onclose = () => {
            console.log('Connexion WebSocket fermée.');
        };

        ws.current.onerror = (err) => {
            console.error('Erreur WebSocket:', err);
        };

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };

    }, []);

    useEffect(() => {
        const fetchMessagesAndConversation = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setError('Vous devez être connecté pour voir les messages.');
                    setLoading(false);
                    return;
                }
                
                const config = {
                    headers: { 'Authorization': `Bearer ${token}` }
                };
                
                // Obtenir l'URL de l'API
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

                // Récupérer les messages initiaux
                const messagesRes = await axios.get(`${API_URL}/api/conversations/${id}/messages`, config);
                setMessages(messagesRes.data.messages);
                
                // Récupérer les détails de la conversation
                // const convRes = await axios.get(`${API_URL}/api/conversations/${id}`, config);
                // setConversation(convRes.data.conversation);
                
                setLoading(false);
            } catch (err) {
                setError('Erreur lors du chargement des messages.');
                console.error(err);
                setLoading(false);
            }
        };

        if (id) {
            fetchMessagesAndConversation();
        }
    }, [id]);

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
            return;
        }

        // Envoyer le message via WebSocket
        ws.current.send(JSON.stringify({
            type: 'message',
            content: newMessage,
            conversationId: id,
            token: localStorage.getItem('token')
        }));
        
        setNewMessage('');
    };
    
    if (loading) return <div className="text-center text-xl font-medium text-gray-700">Chargement des messages...</div>;
    if (error) return <div className="text-center text-red-500 font-bold">{error}</div>;

    return (
        <div className="flex flex-col h-[80vh] bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
                Conversation
            </h1>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                {messages.map((msg) => (
                    <div
                        key={msg._id}
                        className={`flex ${msg.sender._id === user?.userId ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`p-3 rounded-xl max-w-[70%] shadow-sm ${msg.sender._id === user?.userId ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                        >
                            <p className="font-semibold text-sm mb-1">{msg.sender.name}</p>
                            <p className="text-sm">{msg.content}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2 mt-4">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez votre message..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                >
                    Envoyer
                </button>
            </form>
        </div>
    );
};

export default Conversation;
