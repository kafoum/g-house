// Fichier : frontend/src/components/SearchBar.jsx (Correction des types de logement)

import React from 'react';

const SearchBar = ({ filters, handleChange }) => {
  return (
    <div className="filters-container">
      {/* ... (city, price_min, price_max inchangés) ... */}
      <select name="type" value={filters.type} onChange={handleChange}>
        <option value="">Tous les types</option>
        {/* 🔑 CLÉ : Utilisation des enums du modèle Housing.js */}
        <option value="chambre">Chambre</option>
        <option value="studio">Studio</option>
        <option value="T1">T1 (F1)</option>
        <option value="T2">T2 (F2)</option>
        {/* Ajoutez T3, T4 si le modèle Housing.js a été mis à jour pour les inclure */}
      </select>
    </div>
  );
};

export default SearchBar;