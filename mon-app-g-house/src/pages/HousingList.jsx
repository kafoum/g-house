import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const HousingList = () => {
  const [housing, setHousing] = useState([]);
  const [filters, setFilters] = useState({ city: '', price_min: '', price_max: '', type: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHousing();
  }, [filters]);

  const fetchHousing = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('https://g-house-api.onrender.com/api/housing', {
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

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <h1>Logements disponibles</h1>

      {/* Formulaire de filtres */}
      <div className="filters-container">
        <input
          type="text"
          name="city"
          placeholder="Ville"
          value={filters.city}
          onChange={handleChange}
        />
        <input
          type="number"
          name="price_min"
          placeholder="Prix min."
          value={filters.price_min}
          onChange={handleChange}
        />
        <input
          type="number"
          name="price_max"
          placeholder="Prix max."
          value={filters.price_max}
          onChange={handleChange}
        />
        <select name="type" value={filters.type} onChange={handleChange}>
          <option value="">Tous les types</option>
          <option value="apartment">Appartement</option>
          <option value="house">Maison</option>
          <option value="studio">Studio</option>
        </select>
      </div>

      {loading && <p>Chargement des logements...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && housing.length === 0 && <p>Aucun logement ne correspond à vos critères de recherche.</p>}

      <div className="housing-grid">
        {housing.map((item) => (
          <div key={item._id} className="housing-card">
            <img src={item.images[0] || 'placeholder.jpg'} alt={`Image de ${item.title}`} />
            <h3><Link to={`/housing/${item._id}`}>{item.title}</Link></h3>
            <p>{item.location.city}</p>
            <p>{item.price} € / mois</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HousingList;