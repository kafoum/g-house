import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CreateHousing = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'chambre',
    price: '',
    location: {
      address: '',
      city: '',
      zipCode: '',
      country: '',
    },
    amenities: '',
    images: [],
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

  const handleImageChange = (e) => {
    setFormData(prev => ({
      ...prev,
      images: Array.from(e.target.files),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage("Vous devez être connecté pour créer une annonce.");
      setLoading(false);
      return;
    }

    const dataToSend = new FormData();
    dataToSend.append('title', formData.title);
    dataToSend.append('description', formData.description);
    dataToSend.append('type', formData.type);
    dataToSend.append('price', formData.price);
    dataToSend.append('location', JSON.stringify(formData.location));
    dataToSend.append('amenities', formData.amenities);

    formData.images.forEach(image => {
      dataToSend.append('images', image);
    });

    try {
      await axios.post('https://g-house-api.onrender.com/api/housing', dataToSend, {
        headers: {
          'Authorization': `Bearer ${token}`, // Ajout du token
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage('Annonce créée avec succès !');
      setTimeout(() => {
        navigate('/housing');
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Erreur lors de la création de l\'annonce. Vérifiez si votre serveur est en ligne.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Créer une nouvelle annonce</h2>
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
          <label htmlFor="images">Images :</label>
          <input type="file" id="images" name="images" multiple onChange={handleImageChange} accept="image/*" required />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Création en cours...' : 'Créer l\'annonce'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default CreateHousing;
