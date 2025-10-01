import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api'; // ✅ CORRECTION : Le chemin vers l'API est maintenant correct.
import { useAuth } from '../context/AuthContext'; 
import BookingForm from '../components/BookingForm'; 
import ChatButton from '../components/ChatButton'; // 🔑 Importation du bouton de chat
import './HousingDetails.css';

const HousingDetail = () => {
  const { id } = useParams();
  const { user } = useAuth(); // Récupère les informations de l'utilisateur connecté
  const [housing, setHousing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHousingDetails = async () => {
      try {
        const response = await api.get(`/housing/${id}`);
        // Assurez-vous que l'objet logement retourné est stocké
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

  // Vérifie si l'utilisateur connecté est le propriétaire de l'annonce
  const isLandlord = user && housing.landlord && (user.userId === housing.landlord._id || user.userId === housing.landlord);

  return (
    <div className="housing-details">
      
      {/* 1. SECTION IMAGE FLOTTANTE */}
      <div className="housing-images">
        {housing.images.map((image, index) => (
          <img key={index} src={image} alt={`${housing.title} - ${index}`} className="floating-image" />
        ))}
      </div>

      {/* 2. SECTION INFORMATIONS */}
      <div className="housing-info-overlay">
        <h1 className="title-animation">{housing.title}</h1>
        <p className="description-animation">{housing.description}</p>
        <p className="price-animation">
          **{housing.price}€ par mois**
        </p>

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
        
        {/* 3. SECTION INTERACTION (Réservation/Chat/Édition) */}
        <div className="interaction-section">
          {/* Si l'utilisateur est le propriétaire de l'annonce, il ne peut ni réserver ni chatter avec lui-même */}
          {isLandlord ? (
            <p className="owner-message">Ceci est votre annonce. Gérez-la depuis votre Tableau de Bord.</p>
          ) : (
            <>
              {/* Formulaire de réservation (disponible pour tous les utilisateurs non-propriétaires) */}
              <BookingForm 
                housingId={housing._id} 
                price={housing.price} 
                landlordId={housing.landlord._id || housing.landlord} 
              />
              
              {/* Bouton de chat (disponible si l'utilisateur est connecté et n'est pas le propriétaire) */}
              {user && (
                <ChatButton 
                  recipientId={housing.landlord._id || housing.landlord} 
                  housingId={housing._id}
                  subject={`Conversation concernant : ${housing.title}`}
                />
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default HousingDetail;