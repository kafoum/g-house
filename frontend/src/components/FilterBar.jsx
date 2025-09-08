import React, { useState } from 'react';
import './FilterBar.css';

const FilterBar = ({ onFilter }) => {
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [type, setType] = useState('');

  const handleFilter = (e) => {
    e.preventDefault();
    onFilter({ minPrice, maxPrice, type });
  };

  return (
    <form className="filter-bar" onSubmit={handleFilter}>
      <div className="filter-group">
        <label htmlFor="type">Type de logement:</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Tous</option>
          <option value="chambre">Chambre</option>
          <option value="studio">Studio</option>
          <option value="T1">T1</option>
          <option value="T2">T2</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="min-price">Prix min (€):</label>
        <input
          id="min-price"
          type="number"
          placeholder="Min"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="max-price">Prix max (€):</label>
        <input
          id="max-price"
          type="number"
          placeholder="Max"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        />
      </div>

      <button type="submit">Filtrer</button>
    </form>
  );
};

export default FilterBar;