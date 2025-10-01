import React from 'react';

const SearchBar = ({ filters, handleChange }) => {
  return (
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
  );
};

export default SearchBar;