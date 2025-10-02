// Fichier : src/pages/CreateHousing.jsx (Version corrigée)

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createHousing, updateHousing, getHousingDetails } from '../api/api'; 
// Importez vos styles CSS si nécessaire
// import './CreateHousing.css'; 

const initialFormData = {
  title: '',
  description: '',
  price: '', // Sera converti en string pour FormData
  location: {
    address: '',
    city: '',
    zipCode: ''
  },
  type: 'chambre',
  amenities: '' // String séparée par des virgules
};

const CreateHousing = () => {
  const { id } = useParams(); // Récupère l'ID si nous sommes en mode édition
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormData);
  const [images, setImages] = useState([]); // Pour les NOUVEAUX fichiers à uploader
  const [existingImages, setExistingImages] = useState([]); // Pour les URLs des images EXISTANTES
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
            price: housing.price.toString(), // Assurez-vous que le prix est une string pour l'input
            location: housing.location || initialFormData.location,
            type: housing.type,
            amenities: housing.amenities.join(', '), // Joindre le tableau en string pour l'input
          });
          setExistingImages(housing.images || []);
        } catch (err) {
          setError("Erreur lors du chargement de l'annonce.");
          console.error("Erreur de chargement:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchHousingData();
    } else {
      setFormData(initialFormData); // Réinitialiser pour la création
    }
  }, [id, isEditMode]);

  // --- Gestion des changements de formulaire ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name in formData.location) {
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [name]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleFileChange = (e) => {
    // Convertir la FileList en Array pour une gestion plus simple
    setImages(Array.from(e.target.files)); 
  };
  
  // --- Soumission du formulaire ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError(null);
    setLoading(true);

    try {
        const formDataPayload = new FormData();

        // 🔑 CORRECTION: Ajout des champs de données de manière APLANIE (flattened)
        formDataPayload.append('title', formData.title);
        formDataPayload.append('description', formData.description);
        // Le prix DOIT être ajouté comme une chaîne de caractères
        formDataPayload.append('price', String(formData.price)); 
        formDataPayload.append('type', formData.type);

        // Ajout des champs d'adresse aplanis (location.address -> address)
        formDataPayload.append('address', formData.location.address);
        formDataPayload.append('city', formData.location.city);
        formDataPayload.append('zipCode', formData.location.zipCode);
        
        // Ajout des équipements (amenities)
        formDataPayload.append('amenities', formData.amenities); 

        // Ajout des NOUVELLES images
        images.forEach(image => {
            // 'images' doit correspondre au nom de champ dans Multer (upload.array('images', 5))
            formDataPayload.append('images', image); 
        });

        // Appel API
        let response;
        if (isEditMode) {
            response = await updateHousing(id, formDataPayload);
        } else {
            response = await createHousing(formDataPayload);
        }

        setMessage(isEditMode ? 'Annonce modifiée avec succès!' : 'Annonce créée avec succès!');
        
        // Optionnel : Réinitialiser le formulaire en mode création
        if (!isEditMode) {
            setFormData(initialFormData);
            setImages([]);
        }

        // Rediriger après un petit délai
        setTimeout(() => {
            navigate('/dashboard'); 
        }, 2000); 

    } catch (err) {
        // Afficher le message d'erreur du backend (validation 400 ou autre 500)
        const apiMessage = err.response?.data?.message || "Erreur inconnue lors de la soumission de l'annonce.";
        setError(apiMessage);
        console.error("Erreur de soumission:", err.response || err);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="create-housing-container">
      <h2>{isEditMode ? 'Modifier l\'Annonce' : 'Créer une Nouvelle Annonce'}</h2>
      
      <form onSubmit={handleSubmit} className="housing-form">
        
        {/* Champ Titre */}
        <label htmlFor="title">Titre</label>
        <input 
          type="text" 
          name="title" 
          id="title" 
          value={formData.title} 
          onChange={handleChange} 
          required 
        />

        {/* Champ Description */}
        <label htmlFor="description">Description</label>
        <textarea 
          name="description" 
          id="description" 
          value={formData.description} 
          onChange={handleChange} 
          required 
        />
        
        {/* Champ Prix */}
        <label htmlFor="price">Prix par mois (€)</label>
        <input 
          type="number" 
          name="price" 
          id="price" 
          value={formData.price} 
          onChange={handleChange} 
          required 
          min="1"
          step="0.01"
        />

        {/* Champ Type */}
        <label htmlFor="type">Type de Logement</label>
        <select 
          name="type" 
          id="type" 
          value={formData.type} 
          onChange={handleChange} 
          required
        >
          <option value="chambre">Chambre</option>
          <option value="studio">Studio</option>
          <option value="T1">T1</option>
          <option value="T2">T2</option>
        </select>

        {/* --- Champs de l'Adresse (location) --- */}
        <fieldset className="location-group">
          <legend>Localisation</legend>
          
          <label htmlFor="address">Adresse</label>
          <input 
            type="text" 
            name="address" 
            id="address" 
            value={formData.location.address} 
            onChange={handleChange} 
            required 
          />

          <label htmlFor="city">Ville</label>
          <input 
            type="text" 
            name="city" 
            id="city" 
            value={formData.location.city} 
            onChange={handleChange} 
            required 
          />
          
          <label htmlFor="zipCode">Code Postal</label>
          <input 
            type="text" 
            name="zipCode" 
            id="zipCode" 
            value={formData.location.zipCode} 
            onChange={handleChange} 
            required 
          />
        </fieldset>
        
        {/* Champ Équipements */}
        <label htmlFor="amenities">Équipements (séparés par des virgules)</label>
        <input 
          type="text" 
          name="amenities" 
          id="amenities" 
          value={formData.amenities} 
          onChange={handleChange} 
          placeholder="Ex: Wi-Fi, Lave-linge, Balcon"
        />

        {/* Affichage des images existantes en mode édition */}
        {isEditMode && existingImages.length > 0 && (
          <div className="existing-images-preview">
            <h4>Images Actuelles ({existingImages.length})</h4>
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
        <label htmlFor="images">Télécharger les images (choisissez plusieurs fichiers, max 5)</label>
        <input 
          type="file" 
          name="images" 
          id="images" 
          onChange={handleFileChange} 
          multiple 
          accept="image/*" 
        />
        
        {/* Bouton de soumission */}
        <button type="submit" disabled={loading} className="btn-submit">
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