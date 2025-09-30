import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
// Import des fonctions de l'API (qui utilisent Axios)
import { getUserHousing, getBookings, deleteHousing, updateBookingStatus } from '../api/api'; 
import { useAuth } from '../context/AuthContext';
import LandlordHousingItem from '../components/LandlordHousingItem'; // Composant à créer

const Dashboard = () => {
  const { user } = useAuth(); // On récupère l'utilisateur connecté pour l'affichage
  const [userHousing, setUserHousing] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Récupération des données ---

  const fetchData = async () => {
    if (!user) {
        setError("Accès non autorisé.");
        setLoading(false);
        return;
    }
    
    try {
        // 1. Récupérer les annonces du propriétaire
        const housingResponse = await getUserHousing();
        setUserHousing(housingResponse.data.housing || []);
        
        // 2. Récupérer toutes les réservations liées aux logements de l'utilisateur
        const bookingResponse = await getBookings();
        // Filtrer les réservations pour ne montrer que celles liées à un logement qui lui appartient (utile si l'API renvoie TOUTES les bookings de l'utilisateur, même celles faites en tant que locataire)
        const landlordHousingIds = housingResponse.data.housing.map(h => h._id);
        const landlordBookings = bookingResponse.data.bookings.filter(b => landlordHousingIds.includes(b.housing._id));

        setBookings(landlordBookings);

    } catch (err) {
        console.error("Erreur lors de la récupération du dashboard:", err);
        setError(err.message || "Erreur lors de la récupération des données.");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]); 
  
  // --- Gestion des actions ---

  // Action de suppression d'annonce
  const handleHousingDelete = async (housingId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette annonce ?")) {
      try {
        await deleteHousing(housingId);
        // Mettre à jour la liste des annonces et des réservations après suppression
        fetchData();
        alert("Annonce supprimée avec succès.");
      } catch (err) {
        alert("Erreur lors de la suppression de l'annonce : " + err.message);
      }
    }
  };

  // Action de mise à jour du statut de réservation
  const handleUpdateBookingStatus = async (bookingId, status) => {
    try {
      await updateBookingStatus(bookingId, status);
      // Actualiser la liste des réservations
      fetchData(); 
      alert(`Réservation ${status} avec succès.`);
    } catch (err) {
      alert("Erreur lors de la mise à jour du statut : " + err.message);
    }
  };


  if (loading) {
    return <p className="dashboard-loading">Chargement du tableau de bord...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }
  
  // Si l'utilisateur est bien propriétaire, on affiche le dashboard
  return (
    <div className="dashboard-container">
      <h1>Bonjour, {user.name}</h1>
      <p className="user-role">Rôle : {user.role === 'landlord' ? 'Propriétaire' : 'Locataire'}</p>
      
      <Link to="/create-housing" className="dashboard-link">Créer une nouvelle annonce ➕</Link>
      
      {/* SECTION 1: MES ANNONCES */}
      <div className="dashboard-section">
        <h2>Mes annonces ({userHousing.length})</h2>
        {userHousing.length > 0 ? (
          <div className="housing-management-grid">
            {userHousing.map((housing) => (
              <LandlordHousingItem 
                key={housing._id} 
                housing={housing}
                onDelete={handleHousingDelete}
              />
            ))}
          </div>
        ) : (
          <p>Vous n'avez pas encore publié d'annonce.</p>
        )}
      </div>

      <hr />

      {/* SECTION 2: GESTION DES RÉSERVATIONS */}
      <div className="dashboard-section">
        <h2>Réservations de mes logements ({bookings.length})</h2>
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
                
                {/* Liens de messagerie (à implémenter) */}
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