import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import LandlordHousingList from '../components/LandlordHousingList';

const Dashboard = () => {
  const [userHousing, setUserHousing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserHousing = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError("Vous devez être connecté pour voir vos annonces.");
      setLoading(false);
      return;
    }
    
    try {
      const response = await api.get('/user/housing', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUserHousing(response.data.housing);
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la récupération de vos annonces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserHousing();
  }, []);

  const handleHousingDeleted = (deletedId) => {
    // Met à jour la liste en retirant l'annonce supprimée
    setUserHousing(currentHousing => currentHousing.filter(housing => housing._id !== deletedId));
  };

  if (loading) {
    return <p>Chargement du tableau de bord...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div className="dashboard-container">
      <h1>Mon tableau de bord</h1>
      <Link to="/create-housing" className="dashboard-link">Créer une nouvelle annonce</Link>
      
      <h3>Mes annonces</h3>
      <LandlordHousingList housing={userHousing} onHousingDeleted={handleHousingDeleted} />
    </div>
  );
};

export default Dashboard;