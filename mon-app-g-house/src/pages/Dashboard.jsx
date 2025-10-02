// Fichier : frontend/src/pages/Dashboard.jsx (Ajout de l'import)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUserHousing, getBookings, deleteHousing, updateBookingStatus, getTenantProfileDocs } from '../api/api'; 
import { useAuth } from '../context/AuthContext';
import LandlordHousingItem from '../components/LandlordHousingItem'; 
// 🔑 Importation du nouveau composant
import TenantDocUploader from '../components/TenantDocUploader'; 

const Dashboard = () => {
  const { user, role } = useAuth(); // Utilisation de role directement
  // ... (autres états et fetchData) ...

  // 🔑 NOUVEAU : Fonction pour gérer la consultation des documents du locataire
  const handleViewDocs = async (tenantId) => {
    // Note : Cette fonction devrait être implémentée pour ouvrir les documents dans une modale ou une nouvelle page.
    try {
        const response = await getTenantProfileDocs(tenantId);
        // Ici, on pourrait ouvrir une modale pour afficher response.data.documents
        console.log(`Documents du locataire ${tenantId}:`, response.data.documents);
        alert(`Documents récupérés pour le locataire. Consultez la console pour les URLs. Nombre de docs: ${response.data.documents.length}`);
    } catch (err) {
        alert("Erreur lors de la récupération des documents. Assurez-vous d'avoir la permission.");
        console.error("Erreur de récupération des docs:", err);
    }
  };


  // ... (Rendu) ...
  
  // 🔑 Modifiez le rendu pour inclure le gestionnaire de documents si c'est un locataire
  return (
    <div className="dashboard-container p-8">
      <h1 className="text-4xl font-extrabold mb-8 text-gray-900">
          Tableau de Bord {user.role === 'landlord' ? 'Propriétaire' : 'Locataire'}
      </h1>

      {/* 🔑 CLÉ : Affichage du composant DocumentUploader si c'est un locataire */}
      {user.role === 'tenant' && <TenantDocUploader />}
      
      {/* 🔑 Reste du contenu du Dashboard pour le propriétaire */}
      {user.role === 'landlord' && (
        <>
          {/* Section Annonces (Existante) */}
          <div className="housing-section">
            <h2 className="text-3xl font-bold mb-6 text-indigo-700">Mes Annonces ({userHousing.length})</h2>
            {/* ... (Rendu LandlordHousingItem) ... */}
          </div>

          <hr className="my-8" />

          {/* Section Réservations */}
          <div className="bookings-section">
            <h2 className="text-3xl font-bold mb-6 text-indigo-700">Réservations en cours et confirmées ({bookings.length})</h2>
            <div className="bookings-list space-y-4">
              {bookings.length > 0 ? (
                bookings.map((booking) => (
                  <div key={booking._id} className={`booking-card p-4 rounded-lg shadow-md border ${booking.status === 'confirmed' ? 'border-green-400' : 'border-yellow-400'}`}>
                    {/* ... (Affichage des détails de réservation existants) ... */}
                    <p><strong>Logement :</strong> {booking.housing.title}</p>
                    <p><strong>Locataire :</strong> {booking.tenant.name}</p>
                    <p><strong>Statut :</strong> <span className={`status-badge font-bold ${booking.status === 'confirmed' ? 'text-green-600' : 'text-yellow-600'}`}>{booking.status.toUpperCase()}</span></p>

                    {/* Actions de gestion du statut (Existantes) */}
                    {booking.status === 'pending' && (
                      <div className="booking-actions mt-3 flex space-x-3">
                        <button onClick={() => handleUpdateBookingStatus(booking._id, 'confirmed')} className="btn-confirm bg-green-500 hover:bg-green-600 text-white p-2 rounded text-sm">Confirmer ✅</button>
                        <button onClick={() => handleUpdateBookingStatus(booking._id, 'cancelled')} className="btn-cancel bg-red-500 hover:bg-red-600 text-white p-2 rounded text-sm">Annuler ❌</button>
                      </div>
                    )}
                    
                    {/* 🔑 CLÉ : Bouton de consultation des documents du locataire */}
                    {booking.status !== 'cancelled' && (
                        <button 
                            onClick={() => handleViewDocs(booking.tenant._id)} 
                            className="btn-view-docs bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-sm mt-3 ml-3"
                        >
                            Voir les Documents du Locataire 📄
                        </button>
                    )}
                    
                    {/* Lien de messagerie avec l'ID du destinataire (Existante) */}
                    <Link 
                        to={`/conversations/start?housingId=${booking.housing._id}&recipientId=${booking.tenant._id}`} 
                        className="btn-message bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded text-sm mt-3 ml-3 inline-block"
                    >
                        Contacter le locataire 💬
                    </Link>
                  </div>
                ))
              ) : (
                <p>Aucune réservation en attente ou confirmée pour vos logements.</p>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default Dashboard;