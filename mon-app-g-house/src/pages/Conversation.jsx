import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const Conversation = () => {
    const { id } = useParams();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000); // Rafraîchissement toutes les 5 secondes
        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchMessages = async () => {
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const response = await axios.get(`https://g-house-api.onrender.com/api/conversations/${id}/messages`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
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
        if (!newMessage.trim()) return;
        const token = localStorage.getItem('token');
        try {
            await axios.post(`https://g-house-api.onrender.com/api/conversations/${id}/messages`,
                { content: newMessage },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            setNewMessage('');
            fetchMessages(); // Rafraîchir les messages
        } catch (err) {
            setError('Erreur lors de l\'envoi du message.');
            console.error(err);
        }
    };

    const user = JSON.parse(localStorage.getItem('user'));

    if (loading) return <p className="text-center text-gray-500">Chargement des messages...</p>;
    if (error) return <p className="text-center text-red-500">{error}</p>;

    return (
        <div className="flex flex-col h-screen max-w-lg mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-center">Conversation</h2>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                    <p className="text-center text-gray-500">Commencez la conversation !</p>
                ) : (
                    messages.map(msg => (
                        <div key={msg._id} className={`flex ${msg.sender._id === user.id ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-3 rounded-lg max-w-xs ${msg.sender._id === user.id ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                <strong className="block text-sm font-bold">{msg.sender.name}:</strong>
                                <p className="text-base break-words">{msg.content}</p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t flex">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez un message..."
                    required
                    className="flex-1 p-3 border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    className="bg-blue-500 text-white p-3 rounded-r-lg font-semibold hover:bg-blue-600 transition-colors duration-200"
                >
                    Envoyer
                </button>
            </form>
        </div>
    );
};

export default Conversation;
