import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const EditHousing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    price: '',
    location: {
      address: '',
      city: '',
      zipCode: '',
      country: '',
    },
    amenities: '',
    images: '',
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchHousingData = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get(`https://g-house-api.onrender.com/api/housing/${id}`);
        const housing = response.data.housing;
        
        // S'assurer que seul le propriétaire de l'annonce peut la modifier
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || user.id !== housing.landlord) {
          setMessage("Vous n'êtes pas autorisé à modifier cette annonce.");
          setTimeout(() => navigate('/housing'), 2000);
          return;
        }

        setFormData({
          title: housing.title,
          description: housing.description,
          type: housing.type,
          price: housing.price,
          location: housing.location,
          amenities: housing.amenities.join(', '),
          images: housing.images.join(', '),
        });
        setLoading(false);
      } catch (error) {
        setMessage('Erreur lors du chargement des données de l\'annonce.');
        console.error(error);
        setLoading(false);
      }
    };
    fetchHousingData();
  }, [id, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        location: { ...prev.location, [locationField]: value },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const amenitiesArray = formData.amenities.split(',').map(item => item.trim());
      const imagesArray = formData.images.split(',').map(item => item.trim());

      const dataToSend = {
        ...formData,
        amenities: amenitiesArray,
        images: imagesArray,
      };

      await axios.put(`https://g-house-api.onrender.com/api/housing/${id}`, dataToSend, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setMessage('Annonce mise à jour avec succès !');
      setTimeout(() => {
        navigate(`/housing/${id}`); // Redirige vers l'annonce mise à jour
      }, 1500);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Erreur lors de la mise à jour de l\'annonce.');
      console.error(error);
    }
  };

  if (loading) return <p>Chargement du formulaire...</p>;
  if (message && message.includes("pas autorisé")) return <p>{message}</p>;

  return (
    <div>
      <h2>Modifier l'annonce</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="title">Titre :</label>
          <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="description">Description :</label>
          <textarea id="description" name="description" value={formData.description} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="type">Type de logement :</label>
          <select id="type" name="type" value={formData.type} onChange={handleChange}>
            <option value="chambre">Chambre</option>
            <option value="studio">Studio</option>
            <option value="T1">T1</option>
            <option value="T2">T2</option>
          </select>
        </div>
        <div>
          <label htmlFor="price">Prix (€) :</label>
          <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} required />
        </div>
        
        <h3>Localisation</h3>
        <div>
          <label htmlFor="location.address">Adresse :</label>
          <input type="text" id="location.address" name="location.address" value={formData.location.address} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="location.city">Ville :</label>
          <input type="text" id="location.city" name="location.city" value={formData.location.city} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="location.zipCode">Code postal :</label>
          <input type="text" id="location.zipCode" name="location.zipCode" value={formData.location.zipCode} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="location.country">Pays :</label>
          <input type="text" id="location.country" name="location.country" value={formData.location.country} onChange={handleChange} />
        </div>
        
        <div>
          <label htmlFor="amenities">Commodités (séparées par des virgules) :</label>
          <input type="text" id="amenities" name="amenities" value={formData.amenities} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="images">URLs des images (séparées par des virgules) :</label>
          <input type="text" id="images" name="images" value={formData.images} onChange={handleChange} />
        </div>
        
        <button type="submit">Mettre à jour l'annonce</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default EditHousing;