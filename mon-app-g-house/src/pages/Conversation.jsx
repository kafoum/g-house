import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
// 🔑 Importation de la fonction d'API pour la requête REST initiale
import { getMessages } from '../api/api'; 
// 🔑 Importation du contexte d'authentification
import { useAuth } from '../context/AuthContext'; 

const Conversation = () => {
    const { id: conversationId } = useParams();
    const { user } = useAuth(); // 🔑 Récupère l'utilisateur connecté
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [conversation, setConversation] = useState(null);
    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    
    // Fonction pour scroller en bas des messages
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (!user) {
            setError('Veuillez vous connecter pour accéder à cette conversation.');
            setLoading(false);
            return;
        }

        // 1. Récupération des messages existants (Requête REST)
        const fetchMessages = async () => {
            try {
                // 🔑 Utilisation de la fonction getMessages de l'API
                const response = await getMessages(conversationId); 
                // L'API peut renvoyer la conversation dans la réponse (si elle le fait) ou juste les messages.
                // Pour l'instant, on se concentre sur les messages.
                setMessages(response.data.messages); 
                setLoading(false);
            } catch (err) {
                console.error("Erreur de chargement des messages:", err);
                setError('Impossible de charger les messages.');
                setLoading(false);
            }
        };

        fetchMessages();


        // 2. Initialisation de la connexion WebSocket
        
        // 🔑 Utilisation de l'URL de l'API définie dans .env.local
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; 
        
        // Convertir l'URL HTTP/HTTPS en WS/WSS
        // On retire '/api' à la fin et on change le protocole.
        const WS_PROTOCOL = API_URL.startsWith('https') ? 'wss://' : 'ws://';
        // On retire le protocole actuel pour le remplacer par WS_PROTOCOL
        const BASE_DOMAIN = API_URL.replace(/^https?:\/\//, '').replace(/\/api$/, '');
        const WS_URL = `${WS_PROTOCOL}${BASE_DOMAIN}/ws?token=${localStorage.getItem('token')}&conversationId=${conversationId}`;

        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            console.log('Connexion WebSocket établie.');
        };

        ws.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("Nouveau message reçu:", message);
            // Ajout du nouveau message à la liste
            setMessages((prevMessages) => [...prevMessages, message]);
        };

        ws.current.onclose = () => {
            console.log('Connexion WebSocket fermée.');
        };

        ws.current.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
        };
        
        // Fonction de nettoyage lors du démontage du composant
        return () => {
            ws.current?.close();
        };

    }, [conversationId, user]); // Déclenche si la conversation ou l'utilisateur change

    // Gestion de l'envoi de messages
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
            return;
        }

        const messageData = {
            conversationId,
            content: newMessage,
            senderId: user.userId, // ID de l'utilisateur connecté
            // L'API s'occupe de l'enregistrement et de la diffusion
        };
        
        ws.current.send(JSON.stringify(messageData));
        setNewMessage('');
    };


    if (loading) {
        return <p className="text-center mt-10">Chargement de la conversation...</p>;
    }

    if (error) {
        return <p className="text-center mt-10 text-red-500">{error}</p>;
    }
    
    // Le rendu du chat reste similaire
    return (
        <div className="container mx-auto p-4 max-w-2xl">
            <h2 className="text-3xl font-bold mb-6 text-gray-800 text-center">Conversation</h2>
            
            <div className="flex flex-col gap-3 h-[60vh] overflow-y-auto p-4 bg-gray-50 rounded-lg shadow-inner">
                {messages.map((msg) => (
                    <div
                        key={msg.createdAt + msg.content} // Clé unique basée sur le contenu et l'heure pour les messages temporaires
                        className={`flex ${msg.sender._id === user?.userId ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`p-3 rounded-xl max-w-[70%] shadow-sm ${msg.sender._id === user?.userId ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                        >
                            {/* Assurez-vous que l'objet sender est bien peuplé (populate dans le backend) */}
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
                    disabled={!user}
                />
                <button
                    type="submit"
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400"
                    disabled={!user || newMessage.trim() === ''}
                >
                    Envoyer
                </button>
            </form>
            {error && <p className="text-center mt-4 text-red-500">Erreur : {error}</p>}
        </div>
    );
};

export default Conversation;