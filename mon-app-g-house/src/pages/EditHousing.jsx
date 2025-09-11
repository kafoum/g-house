import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './../api/api'; // Importez l'instance Axios personnalisée

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
    existingImages: [],
    newImages: [],
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchHousingData = async () => {
      try {
        const response = await api.get(`/housing/${id}`);
        const housing = response.data.housing;
        
        // S'assurer que seul le propriétaire de l'annonce peut la modifier
        const token = localStorage.getItem('token');
        if (!token) {
          setMessage("Vous n'êtes pas autorisé à modifier cette annonce.");
          setTimeout(() => navigate('/housing'), 2000);
          return;
        }

        const user = JSON.parse(atob(token.split('.')[1]));
        if (!user || user.userId !== housing.landlord) {
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
          existingImages: housing.images,
          newImages: [],
        });
      } catch (err) {
        setMessage('Impossible de charger les données du logement.');
        console.error(err);
      } finally {
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

  const handleImageChange = (e) => {
    setFormData(prev => ({
      ...prev,
      newImages: Array.from(e.target.files),
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
      } else if (key === 'amenities') {
        data.append('amenities', formData.amenities);
      } else if (key === 'existingImages') {
        data.append('existingImages', JSON.stringify(formData.existingImages));
      } else if (key === 'newImages') {
        formData.newImages.forEach(image => data.append('images', image));
      } else {
        data.append(key, formData[key]);
      }
    }

    try {
      await api.put(`/housing/${id}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage('Annonce mise à jour avec succès !');
      setLoading(false);
      setTimeout(() => navigate('/manage-housing'), 2000);
    } catch (error) {
      setMessage('Échec de la mise à jour de l\'annonce. Veuillez réessayer.');
      console.error(error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Chargement des données...</div>;
  }
  if (message) {
    return <div>{message}</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <h2 className="text-3xl font-bold mb-6 text-center">Modifier une annonce</h2>
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
          <label>Images existantes :</label>
          <div className="flex space-x-2 overflow-x-auto my-2">
            {formData.existingImages.map((image, index) => (
              <img key={index} src={image} alt={`Logement ${index + 1}`} className="w-24 h-24 object-cover rounded-lg" />
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="newImages">Ajouter de nouvelles images :</label>
          <input type="file" id="newImages" name="newImages" multiple onChange={handleImageChange} accept="image/*" />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Mise à jour en cours...' : 'Mettre à jour l\'annonce'}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default EditHousing;