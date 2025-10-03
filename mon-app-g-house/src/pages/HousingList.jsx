// frontend/src/pages/HousingList.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import SearchBar from '../components/SearchBar'; 

const HousingList = () => {
  const [housing, setHousing] = useState([]);
  const [filters, setFilters] = useState({ city: '', price_min: '', price_max: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Déclenche la récupération des logements chaque fois que les filtres changent
  useEffect(() => {
    fetchHousing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Fonction de gestion des changements dans la barre de recherche
  const handleChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  // Fonction de récupération des logements
  const fetchHousing = async () => {
    setLoading(true);
    setError(null);
    try {
      // 🔑 Cet appel enverra les filtres et le backend renverra les annonces 'active'
      const response = await api.get('/housing', { 
        params: filters, 
      });
      setHousing(response.data.housing);
    } catch (err) {
      setError('Impossible de récupérer les logements. Veuillez réessayer plus tard.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="housing-list-container p-6">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-6 text-center">Toutes les Annonces</h1>
      
      {/* 🔑 La SearchBar pour filtrer les résultats */}
      <SearchBar filters={filters} handleChange={handleChange} />
      
      {loading && <p className="text-center text-xl text-blue-600">Chargement des logements...</p>}{/* Ajout d'un indicateur de chargement */}
      {error && <p className="text-center text-xl text-red-600">{error}</p>}

      {!loading && housing.length === 0 && !error && <p className="text-center text-xl text-gray-500">Aucun logement ne correspond à vos critères de recherche.</p>}

      <div className="housing-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
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
              <p className="text-3xl font-bold text-indigo-600">{item.price}€<span className="text-sm font-normal text-gray-500"> / mois</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HousingList;