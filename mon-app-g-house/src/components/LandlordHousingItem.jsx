import React from 'react';
import { Link } from 'react-router-dom';

const LandlordHousingItem = ({ housing, onDelete }) => {
  return (
    <div className="housing-item-card">
      <img src={housing.images[0] || 'placeholder.jpg'} alt={housing.title} className="housing-image" />
      <h3>{housing.title}</h3>
      <p>{housing.price}€ / mois à {housing.location.city}</p>
      <p className="housing-id">ID: {housing._id}</p>
      
      <div className="housing-actions">
        {/* L'édition redirige vers la page de création avec l'ID pour le pré-remplissage */}
        <Link to={`/edit-housing/${housing._id}`} className="btn-edit">
          Modifier
        </Link>
        
        <button onClick={() => onDelete(housing._id)} className="btn-delete">
          Supprimer
        </button>
      </div>
    </div>
  );
};

export default LandlordHousingItem;