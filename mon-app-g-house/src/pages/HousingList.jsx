import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
// 🔑 CORRECTION N°1 : Importer le nouveau composant SearchBar
import SearchBar from '../components/SearchBar'; 

const HousingList = () => {
  const [housing, setHousing] = useState([]);
  const [filters, setFilters] = useState({ city: '', price_min: '', price_max: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Déclenche la récupération des logements chaque fois que les filtres changent
  useEffect(() => {
    fetchHousing();
    // Le tableau de dépendances [filters] est correct pour recharger les données après un changement de filtre
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Fonction de récupération des logements
  const fetchHousing = async () => {
    setLoading(true);
    setError(null);
    try {
      // 🔑 CORRECTION N°2 : Utilisation de l'instance 'api' importée
      // La base URL (https://g-house-api.onrender.com/api) est gérée par l'instance 'api'
      const response = await api.get('/housing', { 
        params: filters, // Les filtres sont passés comme paramètres de requête (ex: /housing?city=Paris)
      });
      setHousing(response.data.housing);
    } catch (err) {
      setError('Impossible de récupérer les logements. Veuillez réessayer plus tard.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Gestionnaire de changement pour les champs de filtres
  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="housing-list-page p-6">
      <h1 className="text-4xl font-bold mb-6 text-center">Logements disponibles</h1>

      {/* 🔑 CORRECTION N°3 : Utilisation du composant SearchBar avec les props nécessaires */}
      <SearchBar filters={filters} handleChange={handleChange} />
      
      {loading && <p className="text-center text-xl text-blue-600">Chargement des logements...</p>}
      {error && <p className="text-center text-xl text-red-600">{error}</p>}

      {!loading && housing.length === 0 && !error && <p className="text-center text-xl text-gray-500">Aucun logement ne correspond à vos critères de recherche.</p>}

      <div className="housing-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {housing.map((item) => (
          <div key={item._id} className="housing-card bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
            <img 
              src={item.images && item.images.length > 0 ? item.images[0] : 'placeholder.jpg'} 
              alt={`Image de ${item.title}`} 
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="text-2xl font-semibold mb-1 truncate">
                <Link to={`/housing/${item._id}`} className="text-gray-900 hover:text-blue-600 transition-colors">
                  {item.title}
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">{item.location.city}</p>
              <p className="text-3xl font-bold text-indigo-600">{item.price} € / mois</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HousingList;