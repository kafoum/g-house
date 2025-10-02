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

  // --- Chargement des données pour l'édition (inchangé) ---
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
            location: {
              address: housing.location.address,
              city: housing.location.city,
              zipCode: housing.location.zipCode,
            },
            type: housing.type,
            amenities: housing.amenities.join(', ') // Convertit le tableau en chaîne
          });
          setExistingImages(housing.images || []); 
          setMessage('Mode édition chargé.');
        } catch (err) {
          setError('Erreur lors du chargement des détails : ' + (err.response?.data?.message || err.message));
        } finally {
          setLoading(false);
        }
      };
      fetchHousingData();
    }
  }, [id, isEditMode]);

  // --- Gestion du changement de champs (incluant le nested location) ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Si le champ est dans l'objet location, on le gère spécifiquement
    if (['address', 'city', 'zipCode'].includes(name)) {
      setFormData(prevData => ({
        ...prevData,
        location: {
          ...prevData.location,
          [name]: value
        }
      }));
    } else {
      setFormData(prevData => ({
        ...prevData,
        [name]: value
      }));
    }
  };

  const handleFileChange = (e) => {
    // Convertit FileList en Array
    setImages(Array.from(e.target.files));
  };

  // --- Fonction de Soumission (CORRIGÉE) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError(null);
    setLoading(true);

    try {
      // 1. Créer le FormData
      const dataToSubmit = new FormData();
      
      // 2. Ajouter les fichiers images
      images.forEach(file => {
          // La clé 'images' doit correspondre à upload.array('images', 10) dans index.js
          dataToSubmit.append('images', file);
      });
      
      // 3. Sérialiser les données du formulaire en JSON string
      // On utilise formData. Notez que si vous êtes en mode édition et que vous n'uploadez pas de nouvelles images, 
      // le champ images dans le formData est vide, mais on envoie bien les données de location.
      dataToSubmit.append('data', JSON.stringify(formData)); 

      // 4. Appel à l'API
      let response;
      if (isEditMode) {
        response = await updateHousing(id, dataToSubmit);
        setMessage('Annonce mise à jour avec succès !');
      } else {
        response = await createHousing(dataToSubmit);
        setMessage('Annonce créée avec succès !');
      }

      // Rediriger ou réinitialiser
      setTimeout(() => {
        // Redirige vers le dashboard après la création ou l'édition
        navigate('/dashboard'); 
      }, 1000);

    } catch (err) {
      setError(err.response?.data?.message || 'Erreur inconnue lors de la soumission de l\'annonce.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-housing-container">
      <h2>{isEditMode ? 'Modifier l\'annonce' : 'Créer une nouvelle annonce'}</h2>
      <form onSubmit={handleSubmit} className="create-housing-form">
        
        {/* TITRE ET DESCRIPTION */}
        <label htmlFor="title">Titre</label>
        <input 
          type="text" 
          name="title" 
          id="title" 
          value={formData.title} 
          onChange={handleChange} 
          required 
        />
        
        <label htmlFor="description">Description</label>
        <textarea
          name="description" 
          id="description" 
          value={formData.description} 
          onChange={handleChange} 
          required 
        />
        
        {/* PRIX ET TYPE */}
        <label htmlFor="price">Prix Mensuel (€)</label>
        <input 
          type="number" 
          name="price" 
          id="price" 
          value={formData.price} 
          onChange={handleChange} 
          required 
          min="1"
        />

        <label htmlFor="type">Type de logement</label>
        <select name="type" id="type" value={formData.type} onChange={handleChange} required>
            <option value="chambre">Chambre</option>
            <option value="studio">Studio</option>
            <option value="appartement">Appartement</option>
            <option value="maison">Maison</option>
        </select>
        
        {/* COMMODITÉS */}
        <label htmlFor="amenities">Commodités (séparées par des virgules, ex: Wifi, Parking, Balcon)</label>
        <input 
            type="text" 
            name="amenities" 
            id="amenities" 
            value={formData.amenities} 
            onChange={handleChange} 
        />

        {/* --- SECTION LOCATION (Adresse) --- */}
        <h3>Localisation</h3>
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
        
        {/* IMAGES EXISTANTES (Mode Édition) */}
        {isEditMode && existingImages.length > 0 && (
          <div style={{ marginTop: '20px' }}>
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