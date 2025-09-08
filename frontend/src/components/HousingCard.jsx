import React from 'react';
import { Link } from 'react-router-dom'; // Importez Link
import './HousingCard.css';

const HousingCard = ({ housing }) => {
  return (
    <Link to={`/housing/${housing._id}`} className="housing-card"> // Ajoutez le Link ici
      <img src={housing.images[0]} alt={housing.title} className="housing-image" />
      <div className="housing-info">
        <h3>{housing.title}</h3>
        <p>{housing.location.city}, {housing.location.zipCode}</p>
        <p className="housing-price">{housing.price}€ par mois</p>
        <div className="housing-amenities">
          {housing.amenities.map((amenity, index) => (
            <span key={index} className="amenity-tag">{amenity}</span>
          ))}
        </div>
      </div>
    </Link>
  );
};

export default HousingCard;