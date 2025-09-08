import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './CreateHousing.css';

const CreateHousing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    location: {
      address: '',
      city: '',
      zipCode: ''
    },
    type: 'chambre',
    amenities: ''
  });
  const [images, setImages] = useState([]); // Nouvel état pour les fichiers
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      const fetchHousingData = async () => {
        try {
          const response = await api.get(`/housing/${id}`);
          const housing = response.data.housing;
          setFormData({
            title: housing.title,
            description: housing.description,
            price: housing.price,
            location: {
              address: housing.location.address,
              city: housing.location.city,
              zipCode: housing.location.zipCode
            },
            type: housing.type,
            amenities: housing.amenities.join(', ')
          });
          // Note : Nous ne pré-remplissons pas le champ de fichier, pour des raisons de sécurité.
        } catch (err) {
          console.error(err);
          setError("Erreur lors du chargement de l'annonce pour la modification.");
        }
      };
      fetchHousingData();
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name in formData.location) {
      setFormData({
        ...formData,
        location: {
          ...formData.location,
          [name]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleFileChange = (e) => {
    setImages(e.target.files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Vous devez être connecté pour créer/modifier une annonce.');
        return;
      }

      // Crée un objet FormData pour inclure les fichiers
      const formUploadData = new FormData();
      for (const key in formData) {
        if (typeof formData[key] === 'object' && formData[key] !== null) {
          for (const subKey in formData[key]) {
            formUploadData.append(`${key}[${subKey}]`, formData[key][subKey]);
          }
        } else {
          formUploadData.append(key, formData[key]);
        }
      }

      // Ajoute chaque fichier au FormData
      for (let i = 0; i < images.length; i++) {
        formUploadData.append('images', images[i]);
      }

      let response;
      if (id) {
        response = await api.put(`/housing/${id}`, formUploadData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data' // Important pour l'envoi de fichiers
          }
        });
        setMessage(response.data.message || "Annonce modifiée avec succès !");
      } else {
        response = await api.post('/housing', formUploadData, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        setMessage(response.data.message || "Annonce créée avec succès !");
        setFormData({
          title: '', description: '', price: '',
          location: { address: '', city: '', zipCode: '' },
          type: 'chambre', amenities: ''
        });
      }
      setError(null);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Erreur lors de l\'opération.');
      setMessage('');
    }
  };

  const formTitle = id ? "Modifier l'annonce" : "Créer une nouvelle annonce";

  return (
    <div className="create-housing-container">
      <h2>{formTitle}</h2>
      <form onSubmit={handleSubmit} className="create-housing-form">
        <input type="text" name="title" placeholder="Titre de l'annonce" value={formData.title} onChange={handleChange} required />
        <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} required></textarea>
        <input type="number" name="price" placeholder="Prix par mois" value={formData.price} onChange={handleChange} required />
        
        <h3>Localisation</h3>
        <input type="text" name="city" placeholder="Ville" value={formData.location.city} onChange={handleChange} required />
        <input type="text" name="address" placeholder="Adresse" value={formData.location.address} onChange={handleChange} required />
        <input type="text" name="zipCode" placeholder="Code postal" value={formData.location.zipCode} onChange={handleChange} required />
        
        <label htmlFor="type">Type de logement</label>
        <select name="type" id="type" value={formData.type} onChange={handleChange}>
          <option value="chambre">Chambre</option>
          <option value="studio">Studio</option>
          <option value="T1">T1</option>
          <option value="T2">T2</option>
        </select>
        
        <input type="text" name="amenities" placeholder="Équipements (séparés par des virgules)" value={formData.amenities} onChange={handleChange} />
        <label htmlFor="images">Télécharger les images</label>
        <input type="file" name="images" id="images" onChange={handleFileChange} multiple />
        
        <button type="submit">{id ? 'Modifier l\'annonce' : 'Créer l\'annonce'}</button>
      </form>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default CreateHousing;