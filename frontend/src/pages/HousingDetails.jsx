import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import './HousingDetails.css';

const HousingDetails = () => {
  const { id } = useParams();
  const [housing, setHousing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHousingDetails = async () => {
      try {
        const response = await api.get(`/housing/${id}`);
        setHousing(response.data.housing);
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la récupération des détails de l'annonce.");
      } finally {
        setLoading(false);
      }
    };
    fetchHousingDetails();
  }, [id]);

  if (loading) {
    return <p>Chargement des détails...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (!housing) {
    return <p>Annonce non trouvée.</p>;
  }

  return (
    <div className="housing-details">
      <div className="housing-images">
        {housing.images.map((image, index) => (
          <img key={index} src={image} alt={`${housing.title} - ${index}`} className="floating-image" />
        ))}
      </div>

      <div className="housing-info-overlay">
        <h1 className="title-animation">{housing.title}</h1>
        <p className="description-animation">{housing.description}</p>
        <p className="price-animation">{housing.price}€ par mois</p>
        <div className="details-group">
          <p><strong>Ville :</strong> {housing.location.city}</p>
          <p><strong>Code postal :</strong> {housing.location.zipCode}</p>
          <p><strong>Type :</strong> {housing.type}</p>
        </div>
        <div className="amenities-group">
          <h3>Équipements :</h3>
          <ul>
            {housing.amenities.map((amenity, index) => (
              <li key={index}>{amenity}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HousingDetails;