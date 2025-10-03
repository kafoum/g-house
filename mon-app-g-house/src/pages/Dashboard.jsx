// frontend/src/pages/Dashboard.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserHousing, getBookings, deleteHousing, updateBookingStatus } from '../api/api'; 
import { useAuth } from '../context/AuthContext';
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
        setUserHousing(housingList); // ✅ userHousing est défini ici
        
        // 2. Récupérer toutes les réservations
        const bookingResponse = await getBookings(); 
        
        // Filtrer les réservations pour ne montrer que celles liées à ses logements
        // 🔑 CORRECTION CLÉ : On utilise 'housingList' pour obtenir la liste des IDs
        const landlordHousingIds = housingList.map(h => h._id.toString());
        
        // On filtre uniquement les réservations qui correspondent aux logements de ce propriétaire
        const filteredBookings = bookingResponse.data.bookings.filter(booking => 
            // On vérifie que l'ID du logement de la réservation est dans la liste des IDs du propriétaire
            landlordHousingIds.includes(booking.housing._id.toString())
        );
        
        setBookings(filteredBookings);
        
    } catch (apiError) {
        setError(`Erreur lors du chargement des données : ${apiError.message || 'Problème de connexion'}`);
        console.error("Erreur API:", apiError);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]); // Rechargement si l'utilisateur change ou se connecte

  // --- Fonctions de gestion d'actions ---
  
  const handleHousingDeleted = (deletedId) => {
    // Recharger toutes les données après la suppression
    fetchData(); 
  };

  const handleUpdateBookingStatus = async (bookingId, status) => {
    if (!window.confirm(`Voulez-vous vraiment ${status === 'confirmed' ? 'confirmer' : 'annuler'} cette réservation ?`)) {
        return;
    }

    try {
        setLoading(true);
        await updateBookingStatus(bookingId, status);
        // Mettre à jour l'état local après la modification
        setBookings(prevBookings => prevBookings.map(b => 
            b._id === bookingId ? { ...b, status: status } : b
        ));
    } catch (err) {
        setError(`Erreur lors de la mise à jour du statut : ${err.message}`);
    } finally {
        setLoading(false);
    }
  };


  if (loading) {
    return <p className="text-center text-xl mt-10">Chargement du Tableau de Bord...</p>;
  }

  if (error) {
    return <p className="text-center text-xl text-red-600 mt-10">{error}</p>;
  }
  
  // Assurez-vous que seul le rôle 'landlord' peut voir ceci
  if (user && user.role !== 'landlord') {
    return <p className="text-center text-xl text-red-600 mt-10">Accès refusé. Vous devez être un propriétaire.</p>;
  }


  return (
    <div className="dashboard-container p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Mon Tableau de Bord Propriétaire</h1>

      {/* --- Section 1: Mes Annonces --- */}
      <div className="mb-10 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-gray-700 border-b pb-2 mb-4">Mes Annonces ({userHousing.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userHousing.length > 0 ? (
            userHousing.map((housing) => (
              <LandlordHousingItem 
                key={housing._id} 
                housing={housing} 
                onDelete={handleHousingDeleted} // Utilisation de la fonction de rechargement/gestion
              />
            ))
          ) : (
            <p className="text-gray-500">Vous n'avez pas encore d'annonces. <Link to="/create-housing" className="text-indigo-600 hover:underline">Créez-en une ici.</Link></p>
          )}
        </div>
      </div>

      {/* --- Section 2: Mes Réservations --- */}
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-gray-700 border-b pb-2 mb-4">Réservations de Mes Logements ({bookings.length})</h2>
        
        {bookings.length > 0 ? (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking._id} className={`booking-card p-4 rounded-lg border ${booking.status === 'pending' ? 'border-yellow-400 bg-yellow-50' : 'border-green-400 bg-green-50'}`}>
                <p><strong>Logement :</strong> {booking.housing.title}</p>
                <p><strong>Locataire :</strong> {booking.tenant.name}</p>
                <p><strong>Période :</strong> Du {new Date(booking.startDate).toLocaleDateString()} au {new Date(booking.endDate).toLocaleDateString()}</p>
                <p>
                    <strong>Statut :</strong> 
                    <span className={`status-badge px-2 py-1 ml-2 rounded-full text-xs font-medium ${
                        booking.status === 'pending' ? 'bg-yellow-500 text-white' : 
                        booking.status === 'confirmed' ? 'bg-green-500 text-white' : 
                        'bg-red-500 text-white'
                    }`}>
                        {booking.status.toUpperCase()}
                    </span>
                </p>

                {/* Actions de gestion du statut */}
                {booking.status === 'pending' && (
                  <div className="booking-actions mt-3 space-x-2">
                    <button onClick={() => handleUpdateBookingStatus(booking._id, 'confirmed')} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition">Confirmer ✅</button>
                    <button onClick={() => handleUpdateBookingStatus(booking._id, 'cancelled')} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition">Annuler ❌</button>
                  </div>
                )}
                
                {/* Lien de messagerie (doit être configuré dans votre router/App.jsx) */}
                <Link to={`/conversations/start?housingId=${booking.housing._id}&recipientId=${booking.tenant._id}`} className="block mt-3 text-indigo-600 hover:text-indigo-800 font-medium">
                    Contacter le locataire 💬
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Aucune réservation en attente ou confirmée pour vos logements.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;