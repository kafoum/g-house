import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import ChatButton from '../components/ChatButton';

const HousingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [housing, setHousing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchHousingDetail = async () => {
      try {
        const response = await axios.get(`https://g-house-api.onrender.com/api/housing/${id}`);
        setHousing(response.data.housing);
        
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && response.data.housing.landlord === user.id) {
          setIsOwner(true);
        }

      } catch (err) {
        setError('Logement non trouvé ou erreur de chargement.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHousingDetail();
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette annonce ?')) {
      const token = localStorage.getItem('token');
      try {
        await axios.delete(`https://g-house-api.onrender.com/api/housing/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        alert('Annonce supprimée avec succès !');
        navigate('/housing'); // Redirige vers la liste des logements
      } catch (err) {
        alert('Erreur lors de la suppression de l\'annonce.');
        console.error(err);
      }
    }
  };

  if (loading) return <p>Chargement des détails du logement...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!housing) return <p>Aucun détail disponible pour ce logement.</p>;

  return (
    <div className="housing-detail-container">
      <h1>{housing.title}</h1>
      <div className="detail-images">
        {housing.images.map((image, index) => (
          <img key={index} src={image} alt={`${housing.title} - Image ${index + 1}`} />
        ))}
      </div>
      <div className="detail-content">
        <p><strong>Description :</strong> {housing.description}</p>
        <p><strong>Prix :</strong> {housing.price} € / mois</p>
        <p><strong>Ville :</strong> {housing.location.city}</p>
        <p><strong>Adresse :</strong> {housing.location.address}</p>
        <p><strong>Type :</strong> {housing.type}</p>
        <p><strong>Commodités :</strong></p>
        <ul>
          {housing.amenities.map((amenity, index) => (
            <li key={index}>{amenity}</li>
          ))}
        </ul>
      </div>

      {isOwner ? (
        <div className="owner-actions">
          <button onClick={() => navigate(`/housing/edit/${housing._id}`)}>Modifier</button>
          <button onClick={handleDelete} style={{ marginLeft: '10px' }}>Supprimer</button>
        </div>
      ) : (
        <ChatButton landlordId={housing.landlord} />
      )}
    </div>
  );
};

export default HousingDetail;