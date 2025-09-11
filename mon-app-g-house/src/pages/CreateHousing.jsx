import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './../api/api'; // Importez l'instance Axios personnalisée

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

    const data = new FormData();
    for (const key in formData) {
      if (key === 'location') {
        data.append('location', JSON.stringify(formData.location));
      } else if (key === 'images') {
        formData.images.forEach(image => data.append('images', image));
      } else {
        data.append(key, formData[key]);
      }
    }

    try {
      await api.post('/housing', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage('Annonce créée avec succès !');
      setLoading(false);
      setTimeout(() => navigate('/manage-housing'), 2000);
    } catch (error) {
      setMessage('Échec de la création de l\'annonce. Veuillez réessayer.');
      console.error(error);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <h2 className="text-3xl font-bold mb-6 text-center">Créer une nouvelle annonce</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title">Titre :</label>
          <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="description">Description :</label>
          <textarea id="description" name="description" value={formData.description} onChange={handleChange} required></textarea>
        </div>
        <div>
          <label htmlFor="type">Type de logement :</label>
          <select id="type" name="type" value={formData.type} onChange={handleChange} required>
            <option value="chambre">Chambre</option>
            <option value="appartement">Appartement</option>
            <option value="maison">Maison</option>
          </select>
        </div>
        <div>
          <label htmlFor="price">Prix par mois :</label>
          <input type="number" id="price" name="price" value={formData.price} onChange={handleChange} required />
        </div>

        <h3>Adresse</h3>
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