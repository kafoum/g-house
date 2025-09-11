import React, { useState, useEffect } from 'react';
import api from '../api/api'; 
import { useNavigate } from 'react-router-dom';

const ManageHousing = () => {
  const [housingList, setHousingList] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserHousing = async () => {
      try {
        const response = await api.get('/user/housing'); 
        setHousingList(response.data.housing);
      } catch (error) {
        setMessage('Erreur lors de la récupération des annonces.');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserHousing();
  }, []);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette annonce ?");
    if (!confirmDelete) {
      return;
    }

    try {
      await api.delete(`/housing/${id}`);
      setMessage('Annonce supprimée avec succès.');
      setHousingList(prevList => prevList.filter(housing => housing._id !== id));
    } catch (error) {
      setMessage('Erreur lors de la suppression de l\'annonce.');
      console.error(error);
    }
  };

  const handleEdit = (id) => {
    navigate(`/update-housing/${id}`);
  };

  if (loading) {
    return <div>Chargement des annonces...</div>;
  }

  if (message) {
    return <div>{message}</div>;
  }

  if (housingList.length === 0) {
    return <div>Vous n'avez pas encore d'annonces.</div>;
  }

  return (
    <div>
      <h2>Gérer mes annonces</h2>
      <div className="housing-grid">
        {housingList.map(housing => (
          <div key={housing._id} className="housing-card">
            <h3>{housing.title}</h3>
            <p>{housing.description}</p>
            <p>Prix: {housing.price}€</p>
            <p>Type: {housing.type}</p>
            <button onClick={() => handleEdit(housing._id)}>Modifier</button>
            <button onClick={() => handleDelete(housing._id)}>Supprimer</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManageHousing;