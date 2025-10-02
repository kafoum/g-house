// Fichier : frontend/src/pages/HousingList.jsx (Version à jour)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
// 🔑 Importation du composant de recherche
import SearchBar from '../components/SearchBar'; 

const HousingList = () => {
  const [housing, setHousing] = useState([]);
  // 🔑 Initialisation des filtres à vide pour afficher toutes les annonces par défaut
  const [filters, setFilters] = useState({ city: '', price_min: '', price_max: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fonction de gestion des changements de filtres
  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  // Fonction de récupération des logements
  const fetchHousing = async () => {
    setLoading(true);
    setError(null);
    try {
      // 🔑 Utilisation de l'instance 'api' importée
      // Les filtres sont passés comme paramètres de requête (ex: /housing?city=Paris)
      const response = await api.get('/housing', { 
        params: filters,
      });
      setHousing(response.data.housing);
    } catch (err) {
      // Un problème dans les filtres (ex: type invalide) peut causer cette erreur.
      setError('Impossible de récupérer les logements. Veuillez réessayer ou vérifier les filtres.');
      console.error("Erreur de récupération des logements:", err);
      setHousing([]); // Assurez-vous que la liste est vide en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  // Déclenche la récupération des logements chaque fois que les filtres changent
  useEffect(() => {
    fetchHousing();
    // Le tableau de dépendances [filters] est correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 text-center">Toutes les annonces</h1>
      
      {/* SearchBar doit recevoir les props nécessaires */}
      <SearchBar filters={filters} handleChange={handleChange} />
      
      {loading && <p className="text-center text-xl text-indigo-600">Chargement des logements...</p>}
      {error && <p className="text-center text-xl text-red-600">⚠️ {error}</p>}

      {!loading && housing.length === 0 && !error && (
        <p className="text-center text-xl text-gray-500 mt-10">
            Aucun logement ne correspond à vos critères de recherche.
        </p>
      )}

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
                <Link to={`/housing/${item._id}`} className="text-gray-900 hover:text-indigo-600 transition-colors">
                  {item.title}
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">{item.location.city} - {item.type.toUpperCase()}</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{item.price} €</p>
              <p className="text-sm text-gray-500">par mois</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HousingList;