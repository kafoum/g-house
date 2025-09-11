import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from './../api/api'; // Importez l'instance Axios personnalisée

const HousingList = () => {
    const [housing, setHousing] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchHousing = async () => {
            try {
                const response = await api.get('/housing');
                setHousing(response.data.housings);
            } catch (err) {
                setError('Impossible de charger les logements.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchHousing();
    }, []);

    const filteredHousing = housing.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <p className="text-center text-gray-500 mt-10">Chargement des logements...</p>;
    if (error) return <p className="text-center text-red-500 mt-10">{error}</p>;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-6 text-center">Tous les Logements Disponibles</h1>
            <div className="flex justify-center mb-8">
                <input
                    type="text"
                    placeholder="Rechercher par titre ou ville..."
                    className="w-full max-w-lg p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredHousing.length > 0 ? (
                    filteredHousing.map(item => (
                        <div key={item._id} className="bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 overflow-hidden">
                            <Link to={`/housing/${item._id}`}>
                                <img
                                    src={item.images[0] || 'https://via.placeholder.com/400x300.png?text=Pas+d\'image'}
                                    alt={item.title}
                                    className="w-full h-48 object-cover"
                                />
                                <div className="p-5">
                                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">{item.title}</h2>
                                    <p className="text-gray-600 mb-2 truncate">{item.location.city}</p>
                                    <p className="text-blue-600 font-bold text-xl">{item.price} € / mois</p>
                                </div>
                            </Link>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500">Aucun logement trouvé.</p>
                )}
            </div>
        </div>
    );
};

export default HousingList;