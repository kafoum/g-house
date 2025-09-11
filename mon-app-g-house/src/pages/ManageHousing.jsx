import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ManageHousing = () => {
    const [housingList, setHousingList] = useState([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchUserHousing = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setMessage('Vous devez être connecté pour voir vos annonces.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get('https://g-house-api.onrender.com/api/user/housing', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            setHousingList(response.data.housing);
        } catch (error) {
            setMessage('Erreur lors de la récupération des annonces.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserHousing();
    }, []);

    const handleDelete = async (id) => {
        const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette annonce ?");
        if (!confirmDelete) {
            return;
        }

        const token = localStorage.getItem('token');
        try {
            await axios.delete(`https://g-house-api.onrender.com/api/housing/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            setMessage('Annonce supprimée avec succès.');
            setHousingList(prevList => prevList.filter(housing => housing._id !== id));
        } catch (error) {
            setMessage('Erreur lors de la suppression de l\'annonce.');
            console.error(error);
        }
    };

    const handleEdit = (id) => {
        navigate(`/update-housing/${id}`);
    };

    if (loading) {
        return (
            <div className="text-center text-gray-500 mt-10">
                <p>Chargement de vos annonces...</p>
            </div>
        );
    }

    if (message) {
        return (
            <div className="text-center text-red-500 mt-10">
                <p>{message}</p>
            </div>
        );
    }

    if (housingList.length === 0) {
        return (
            <div className="text-center text-gray-500 mt-10">
                <p>Vous n'avez pas encore d'annonces.</p>
                <button
                    onClick={() => navigate('/housing/create')}
                    className="mt-4 py-2 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                    Créer ma première annonce
                </button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">
                Gérer mes annonces
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {housingList.map(housing => (
                    <div key={housing._id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                        <img 
                            src={housing.images[0] || 'https://placehold.co/400x300/6B7280/F9FAFB?text=No+Image'} 
                            alt={housing.title} 
                            className="w-full h-48 object-cover" 
                        />
                        <div className="p-5">
                            <h3 className="text-xl font-bold text-gray-900 mb-1 truncate">{housing.title}</h3>
                            <p className="text-gray-600 mb-2">{housing.location.city}</p>
                            <p className="text-blue-600 font-extrabold text-2xl mb-4">{housing.price} € / mois</p>
                            <div className="flex justify-between gap-4">
                                <button 
                                    onClick={() => handleEdit(housing._id)}
                                    className="flex-1 py-2 px-4 bg-yellow-500 text-white font-bold rounded-lg hover:bg-yellow-600 transition-colors duration-200"
                                >
                                    Modifier
                                </button>
                                <button
                                    onClick={() => handleDelete(housing._id)}
                                    className="flex-1 py-2 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors duration-200"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManageHousing;