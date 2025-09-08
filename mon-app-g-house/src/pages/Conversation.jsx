import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const Conversation = () => {
    const { id } = useParams();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchMessages();
    }, [id]);

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

    if (loading) return <p>Chargement des messages...</p>;
    if (error) return <p className="error">{error}</p>;

    return (
        <div>
            <h2>Conversation</h2>
            <div className="messages-container">
                {messages.map(msg => (
                    <div key={msg._id} className={`message ${msg.sender._id === user.id ? 'sent' : 'received'}`}>
                        <strong>{msg.sender.name}:</strong> {msg.content}
                    </div>
                ))}
            </div>
            <form onSubmit={handleSendMessage}>
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez un message..."
                    required
                />
                <button type="submit">Envoyer</button>
            </form>
        </div>
    );
};

export default Conversation;