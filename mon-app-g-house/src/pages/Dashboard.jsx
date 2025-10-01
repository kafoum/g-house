// frontend/src/pages/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// Import des fonctions de l'API (qui utilisent Axios)
import { getUserHousing, getBookings, deleteHousing, updateBookingStatus } from '../api/api'; 
import { useAuth } from '../context/AuthContext';
// Remplacez LandlordHousingItem par le nom de votre composant d'affichage de logement si différent
import LandlordHousingItem from '../components/LandlordHousingItem'; 

const Dashboard = () => {
  const { user } = useAuth(); 
  const [userHousing, setUserHousing] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Fonction de récupération de toutes les données ---

  const fetchData = async () => {
    if (!user) {
        setError("Accès non autorisé. Veuillez vous reconnecter.");
        setLoading(false);
        return;
    }
    
    try {
        // 1. Récupérer les annonces du propriétaire
        const housingResponse = await getUserHousing();
        const housingList = housingResponse.data.housing || [];
        setUserHousing(housingList);
        
        // 2. Récupérer toutes les réservations
        const bookingResponse = await getBookings(); // ✅ Utilise la fonction corrigée dans api.js
        
        // Filtrer les réservations pour ne montrer que celles liées à ses logements
        const landlordHousingIds = housingList.map(h => h._id);
        const filteredBookings = bookingResponse.data.bookings.filter(
            // Le backend retourne l'objet housing dans la réservation.
            // On vérifie que l'ID de ce logement fait partie des logements du propriétaire.
            booking => landlordHousingIds.includes(booking.housing._id)
        ).filter(
            // Afficher uniquement les statuts pertinents pour le propriétaire
            booking => ['pending', 'confirmed'].includes(booking.status)
        );
        setBookings(filteredBookings);

    } catch (err) {
      const errorMessage = err.response?.data?.message || "Erreur lors du chargement du tableau de bord.";
      setError(errorMessage);
      console.error(err);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]); // Re-fetch si l'utilisateur change (ex: connexion)

  // --- Fonctions de gestion des actions ---
  
  const handleHousingDelete = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette annonce?")) {
      try {
        await deleteHousing(id);
        alert('Annonce supprimée !');
        // Recharger les données après suppression
        fetchData();
      } catch (err) {
        alert('Erreur lors de la suppression de l\'annonce.');
        console.error(err);
      }
    }
  };

  const handleUpdateBookingStatus = async (bookingId, status) => {
    try {
      await updateBookingStatus(bookingId, status);
      alert(`Réservation ${status} !`);
      // Recharger les données après mise à jour
      fetchData(); 
    } catch (err) {
      alert(`Erreur lors de la mise à jour du statut.`);
      console.error(err);
    }
  };

  // --- Rendu ---

  if (loading) {
    return <p>Chargement du tableau de bord...</p>;
  }

  if (error) {
    return <p className="error-message">Erreur : {error}</p>;
  }

  return (
    <div className="dashboard-container">
      <h1>Tableau de Bord Propriétaire</h1>
      <p>Bienvenue, {user.name} ({user.role})</p>

      {/* SECTION ANNONCES */}
      <div className="dashboard-section">
        <h2>Mes Annonces</h2>
        <Link to="/create-housing" className="btn-primary">Créer une nouvelle annonce</Link>
        
        <div className="housing-list">
          {userHousing.length > 0 ? (
            userHousing.map((housing) => (
              // Utilise le composant de gestion pour afficher et gérer les actions
              <LandlordHousingItem 
                key={housing._id} 
                housing={housing} 
                onDelete={handleHousingDelete} 
                // handleEdit est géré par la Link to /edit-housing/:id dans le composant si vous l'avez
              />
            ))
          ) : (
            <p>Vous n'avez pas encore d'annonces.</p>
          )}
        </div>
      </div>

      {/* SECTION RÉSERVATIONS */}
      <div className="dashboard-section">
        <h2>Réservations en cours et confirmées ({bookings.length})</h2>
        
        {bookings.length > 0 ? (
          <div className="bookings-list">
             {bookings.map((booking) => (
              <div key={booking._id} className={`booking-card booking-status-${booking.status}`}>
                <p><strong>Logement :</strong> {booking.housing.title}</p>
                <p><strong>Locataire :</strong> {booking.tenant.name}</p>
                <p><strong>Période :</strong> Du {new Date(booking.startDate).toLocaleDateString()} au {new Date(booking.endDate).toLocaleDateString()}</p>
                <p><strong>Statut :</strong> <span className="status-badge">{booking.status.toUpperCase()}</span></p>

                {/* Actions de gestion du statut */}
                {booking.status === 'pending' && (
                  <div className="booking-actions">
                    <button onClick={() => handleUpdateBookingStatus(booking._id, 'confirmed')} className="btn-confirm">Confirmer ✅</button>
                    <button onClick={() => handleUpdateBookingStatus(booking._id, 'cancelled')} className="btn-cancel">Annuler ❌</button>
                  </div>
                )}
                
                {/* Lien de messagerie avec l'ID du destinataire */}
                <Link to={`/conversations/start?user=${booking.tenant._id}`} className="btn-message">
                    Contacter le locataire 💬
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p>Aucune réservation en attente ou confirmée pour vos logements.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;