// frontend/src/pages/CreateHousing.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createHousing, updateHousing, getHousingDetails } from '../api/api'; 
import './CreateHousing.css'; 

const initialFormData = {
  title: '',
  description: '',
  price: '',
  location: {
    address: '',
    city: '',
    zipCode: ''
  },
  type: 'chambre',
  amenities: '' // String séparée par des virgules
};

const CreateHousing = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormData);
  const [images, setImages] = useState([]); 
  const [existingImages, setExistingImages] = useState([]); 
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isEditMode = !!id;

  // --- Chargement des données pour l'édition (useEffect) ---
  useEffect(() => {
    if (isEditMode) {
      const fetchHousingData = async () => {
        setLoading(true);
        try {
          const response = await getHousingDetails(id); 
          const housing = response.data.housing; 

          setFormData({
            title: housing.title,
            description: housing.description,
            price: housing.price,
            location: housing.location,
            type: housing.type,
            amenities: housing.amenities.join(', ') // Joint les commodités pour l'affichage dans le formulaire
          });
          setExistingImages(housing.images || []);

        } catch (err) {
          setError(`Erreur lors du chargement des données : ${err.message}`);
        } finally {
          setLoading(false);
        }
      };
      fetchHousingData();
    }
  }, [id, isEditMode]);

  // --- Gestion des changements de champs texte/select ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Gestion des sous-objets comme 'location'
    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1];
      setFormData({
        ...formData,
        location: {
          ...formData.location,
          [locationField]: value
        }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // --- Gestion des changements de fichiers ---
  const handleFileChange = (e) => {
    // Récupère la liste des fichiers sélectionnés
    setImages(Array.from(e.target.files)); 
  };

  // --- Soumission du formulaire ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    setLoading(true);

    try {
        // --- Construction du FormData pour l'upload de fichiers ---
        const data = new FormData();
        
        // 1. Ajouter les champs texte 
        data.append('title', formData.title);
        data.append('description', formData.description);
        data.append('price', formData.price);
        data.append('type', formData.type);
        data.append('amenities', formData.amenities);

        // 🔑 CORRECTION MAJEURE: Stringifier l'objet location pour que le backend puisse le parser
        // SANS cette correction, la validation du middleware pourrait échouer (403).
        data.append('location', JSON.stringify(formData.location)); 

        // 2. Ajouter les fichiers images
        images.forEach((file) => {
            data.append('images', file);
        });

        // 3. Appel de l'API
        const response = isEditMode 
            ? await updateHousing(id, data) 
            : await createHousing(data); 

        setMessage(isEditMode ? 'Annonce modifiée avec succès!' : 'Annonce créée avec succès!');
        
        // Redirection après succès
        setTimeout(() => {
            navigate('/dashboard'); 
        }, 1500);

    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Erreur lors de la soumission de l\'annonce.';
      console.error("Erreur lors de la soumission de l'annonce :", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };


  if (loading && isEditMode && !formData.title) {
    return <p>Chargement de l'annonce...</p>;
  }

  return (
    <div className="create-housing-container">
      <h2>{isEditMode ? 'Modifier l\'annonce' : 'Créer une nouvelle annonce'}</h2>
      <form onSubmit={handleSubmit} className="housing-form">
        
        {/* Champs de base */}
        <div>
          <label htmlFor="title">Titre de l'annonce</label>
          <input type="text" name="title" id="title" value={formData.title} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="description">Description</label>
          <textarea name="description" id="description" value={formData.description} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="price">Prix mensuel (€)</label>
          <input type="number" name="price" id="price" value={formData.price} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="type">Type de logement</label>
          <select name="type" id="type" value={formData.type} onChange={handleChange} required>
            <option value="chambre">Chambre</option>
            <option value="studio">Studio</option>
            <option value="apartment">Appartement</option>
            <option value="house">Maison</option>
          </select>
        </div>

        {/* Localisation */}
        <fieldset>
          <legend>Localisation</legend>
          <div>
            <label htmlFor="location.address">Adresse</label>
            <input type="text" name="location.address" id="location.address" value={formData.location.address} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="location.city">Ville</label>
            <input type="text" name="location.city" id="location.city" value={formData.location.city} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="location.zipCode">Code Postal</label>
            <input type="text" name="location.zipCode" id="location.zipCode" value={formData.location.zipCode} onChange={handleChange} required />
          </div>
        </fieldset>

        {/* Commodités */}
        <div>
            <label htmlFor="amenities">Commodités (séparées par des virgules)</label>
            <input 
              type="text" 
              name="amenities" 
              id="amenities" 
              value={formData.amenities} 
              onChange={handleChange} 
              placeholder="Ex: Wifi, Parking, Balcon, Meublé"
            />
        </div>

        {/* Affichage des images existantes (mode édition) */}
        {isEditMode && existingImages.length > 0 && (
          <div>
            <h4>Images actuelles ({existingImages.length})</h4>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              {existingImages.map((url, index) => (
                <img 
                  key={index} 
                  src={url} 
                  alt={`Image existante ${index + 1}`} 
                  style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px' }} 
                />
              ))}
            </div>
            <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#dc3545' }}>
                **Note:** Télécharger de nouveaux fichiers remplacera les images existantes sur l'API, ou l'API gèrera l'ajout si elle est configurée ainsi.
            </p>
          </div>
        )}

        {/* Upload d'images */}
        <label htmlFor="images">Télécharger les images (choisissez plusieurs fichiers)</label>
        <input 
          type="file" 
          name="images" 
          id="images" 
          onChange={handleFileChange} 
          multiple 
          accept="image/*" 
        />
        
        {/* Bouton de soumission */}
        <button type="submit" disabled={loading}>
          {loading ? 'Traitement...' : isEditMode ? 'Sauvegarder les modifications' : 'Créer l\'annonce'}
        </button>
      </form>

      {/* Messages de retour */}
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default CreateHousing;