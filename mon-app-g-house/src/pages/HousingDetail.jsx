import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext'; // 🔑 Importation du contexte pour vérifier si le propriétaire est connecté
import BookingForm from '../components/BookingForm'; // 🔑 Importation du formulaire de réservation
import './HousingDetails.css';

const HousingDetails = () => {
  const { id } = useParams();
  const { user } = useAuth(); // Récupère les informations de l'utilisateur connecté
  const [housing, setHousing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHousingDetails = async () => {
      try {
        // ... (Logique de récupération des détails de l'annonce existante)
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

  // ... (Code de gestion loading/error/not found)

  // Rendu
  return (
    <div className="housing-details">
      {/* ... (Affichage des images et des détails du logement existant) ... */}

      <div className="housing-info-overlay">
        <h1 className="title-animation">{housing.title}</h1>
        {/* ... (Autres détails) ... */}
        
        {/* 🔑 SECTION RÉSERVATION/PAIEMENT */}
        <div className="booking-section">
          <BookingForm 
            housingId={housing._id} 
            price={housing.price} // Prix mensuel pour le calcul
            landlordId={housing.landlord._id || housing.landlord} // Assurez-vous d'avoir l'ID du propriétaire
          />
        </div>
      </div>
    </div>
  );
};

export default HousingDetails;