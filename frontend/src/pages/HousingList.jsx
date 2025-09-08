import React, { useState, useEffect } from 'react';
import api from '../services/api';
import HousingCarousel from '../components/HousingCarousel';
import SearchBar from '../components/SearchBar';
import FilterBar from '../components/FilterBar'; // Importez le nouveau composant
import './HousingList.css';

const HousingList = () => {
  const [housingList, setHousingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});

  useEffect(() => {
    const fetchHousing = async () => {
      try {
        let url = '/housing';
        const params = new URLSearchParams();

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

        const response = await api.get(url);
        setHousingList(response.data.housing);
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la récupération des annonces.");
      } finally {
        setLoading(false);
      }
    };
    fetchHousing();
  }, [searchQuery, filters]); // Le useEffect se déclenche avec la recherche OU les filtres

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
        <HousingCarousel housings={housingList} />
      ) : (
        <p>Aucune annonce trouvée pour le moment.</p>
      )}
    </div>
  );
};

export default HousingList;