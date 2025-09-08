import React from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './LandlordHousingList.css';

const LandlordHousingList = ({ housing, onHousingDeleted }) => {
  // La redirection vers le formulaire de modification est gérée par le composant <Link>

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette annonce ?");
    if (!confirmDelete) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("Token d'authentification manquant.");
      }

      await api.delete(`/housing/${id}`, { // L'API est utilisée ici
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      // 'onHousingDeleted' est utilisée ici pour rafraîchir la liste
      onHousingDeleted(id);
      alert("Annonce supprimée avec succès !");
    } catch (err) {
      console.error('Erreur lors de la suppression de l\'annonce:', err);
      alert("Erreur lors de la suppression de l'annonce.");
    }
  };

  return (
    <div className="landlord-housing-list">
      {housing.length > 0 ? (
        housing.map((item) => (
          <div key={item._id} className="landlord-housing-item">
            <img src={item.images[0]} alt={item.title} className="housing-image" />
            <div className="housing-details">
              <h3>{item.title}</h3>
              <p>{item.location.city}, {item.location.zipCode}</p>
              <p className="housing-price">{item.price} €</p>
            </div>
            <div className="housing-actions">
              <Link to={`/edit-housing/${item._id}`} className="edit-btn">Modifier</Link>
              <button onClick={() => handleDelete(item._id)} className="delete-btn">Supprimer</button>
            </div>
          </div>
        ))
      ) : (
        <p>Vous n'avez pas encore d'annonces.</p>
      )}
    </div>
  );
};

export default LandlordHousingList;