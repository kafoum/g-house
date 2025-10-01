import React, { useState, useEffect } from 'react';
import api from '../api/api'; // ✅ Le chemin d'importation de l'API est corrigé : '../api/api'
const HousingList = () => {
  const [housingList, setHousingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(''); // Pour la recherche par ville
  const [filters, setFilters] = useState({}); // Pour les filtres (type, prix, etc.)

  useEffect(() => {
    fetchHousing();
  }, [searchQuery, filters]); // Le useEffect se déclenche avec la recherche OU les filtres

  const fetchHousing = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/housing';
      const params = new URLSearchParams();

      // Gestion des filtres et de la recherche
      if (searchQuery) {
        params.append('city', searchQuery);
      }
      if (filters.type) {
        params.append('type', filters.type);
      }
      if (filters.minPrice) {
        params.append('price_min', filters.minPrice);
      }
      if (filters.maxPrice) {
        params.append('price_max', filters.maxPrice);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      // ✅ CORRECTION : Utilisation de l'instance 'api' configurée, et non d'axios avec une URL en dur
      const response = await api.get(url); 
      setHousingList(response.data.housing);
      
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la récupération des annonces.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilter = (newFilters) => {
    setFilters(newFilters);
  };


  if (loading) {
    return <p>Chargement des annonces...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div className="housing-list-container">
      <h2>Découvrez nos logements</h2>
      <SearchBar onSearch={handleSearch} />
      <FilterBar onFilter={handleFilter} />
      {housingList.length > 0 ? (
        // Utilisation du composant HousingCarousel (si vous l'avez)
        <HousingCarousel housings={housingList} /> 
      ) : (
        <p>Aucun logement ne correspond à vos critères.</p>
      )}
    </div>
  );
};

export default HousingList;