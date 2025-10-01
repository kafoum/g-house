import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// 🔑 Importation des fonctions spécifiques de l'API (qui utilisent ../api/api)
import { getUserHousing, getBookings, deleteHousing, updateBookingStatus } from '../api/api'; 
import { useAuth } from '../context/AuthContext';
import LandlordHousingItem from '../components/LandlordHousingItem'; 

const Dashboard = () => {
  // 🔑 Récupération de l'utilisateur depuis le contexte
  const { user } = useAuth(); 
  const [userHousing, setUserHousing] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Récupération des données ---

  const fetchData = async () => {
    // Vérifie si l'utilisateur est bien connecté avant l'appel
    if (!user) { 
        setError("Accès non autorisé. Veuillez vous reconnecter.");
        setLoading(false);
        return;
    }
    
    try {
        // 1. Récupérer les annonces du propriétaire via la fonction d'API
        const housingResponse = await getUserHousing();
        setUserHousing(housingResponse.data.housing || []);
        
        // 2. Récupérer toutes les réservations
        const bookingResponse = await getBookings();
        // Filtrer les réservations pour ne montrer que celles liées à ses logements
        const landlordHousingIds = housingResponse.data.housing.map(h => h._id);
        const filteredBookings = bookingResponse.data.bookings.filter(
            booking => landlordHousingIds.includes(booking.housing._id)
        );

        setBookings(filteredBookings);

    } catch (err) {
      console.error(err);
      setError("Erreur lors de la récupération de vos données.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]); // Déclenche le fetch lorsque l'utilisateur est chargé

  // ... (Fonction de suppression d'annonce)
  const handleDeleteHousing = async (housingId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette annonce ?")) {
      try {
        await deleteHousing(housingId);
        // Met à jour la liste en retirant l'annonce supprimée
        setUserHousing(currentHousing => currentHousing.filter(housing => housing._id !== housingId));
      } catch (err) {
        console.error("Erreur lors de la suppression:", err);
        setError("Erreur lors de la suppression de l'annonce.");
      }
    }
  };

  // ... (Fonction de mise à jour du statut de réservation)
  const handleUpdateBookingStatus = async (bookingId, status) => {
    try {
      await updateBookingStatus(bookingId, status);
      // Met à jour l'état local pour refléter le changement
      setBookings(currentBookings => 
        currentBookings.map(booking => 
          booking._id === bookingId ? { ...booking, status: status } : booking
        )
      );
    } catch (err) {
      console.error(`Erreur lors de la mise à jour du statut de la réservation ${bookingId}:`, err);
      setError("Erreur lors de la mise à jour du statut de la réservation.");
    }
  };
  
  // ... (Affichage loading, error)

  if (loading) {
    return <p className="text-center mt-10">Chargement du tableau de bord...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (user?.role !== 'landlord') {
    return <p className="error-message">Seuls les propriétaires ont accès au tableau de bord.</p>;
  }

  return (
    <div className="dashboard-container">
      <h1>Mon tableau de bord</h1>
      <Link to="/create-housing" className="dashboard-link">Créer une nouvelle annonce</Link>
      
      {/* --- Section Mes Annonces --- */}
      <h3>Mes annonces ({userHousing.length})</h3>
      <div className="housing-list">
        {userHousing.length > 0 ? (
          userHousing.map(housing => (
            <LandlordHousingItem 
              key={housing._id} 
              housing={housing} 
              onDelete={handleDeleteHousing}
            />
          ))
        ) : (
          <p>Vous n'avez pas encore publié d'annonce.</p>
        )}
      </div>

      {/* --- Section Mes Réservations --- */}
      <h3>Réservations en attente ou confirmées ({bookings.length})</h3>
      <div className="bookings-list">
        {bookings.length > 0 ? (
          <div className="booking-grid">
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
                
                {/* 🔑 Lien de messagerie avec l'ID du destinataire */}
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