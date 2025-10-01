import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// ✅ CORRECTION : Importation du chemin d'API correct et des fonctions nommées
import { createHousing, updateHousing, getHousingDetails } from '../api/api'; 
import './CreateHousing.css'; // Pour les styles que vous avez fournis

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
  const { id } = useParams(); // Récupère l'ID si nous sommes en mode édition
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormData);
  const [images, setImages] = useState([]); // Pour les NOUVEAUX fichiers à uploader
  const [existingImages, setExistingImages] = useState([]); // Pour les URLs des images EXISTANTES (en mode édition)
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
            location: {
              address: housing.location.address,
              city: housing.location.city,
              zipCode: housing.location.zipCode
            },
            type: housing.type,
            // Convertit le tableau d'amenities en une chaîne séparée par des virgules pour le formulaire
            amenities: housing.amenities.join(', ')
          });
          // Stocke les URLs des images existantes pour l'aperçu
          setExistingImages(housing.images || []);
        } catch (err) {
          console.error(err);
          setError("Erreur lors du chargement de l'annonce pour la modification.");
        } finally {
          setLoading(false);
        }
      };
      fetchHousingData();
    }
  }, [id, isEditMode]);

  // --- Gestion des changements dans les champs de texte et sélections ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Gère les champs imbriqués (location.city, location.address, etc.)
    if (name in formData.location) {
      setFormData(prev => ({
        ...prev,
        location: { ...prev.location, [name]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    // Efface le message de succès/erreur au début de la saisie
    setMessage('');
    setError(null);
  };

  // --- Gestion du changement de fichiers (images) ---
  const handleFileChange = (e) => {
    // Stocke tous les fichiers sélectionnés
    setImages(Array.from(e.target.files));
  };

  // --- Soumission du formulaire (Création ou Modification) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError(null);
    setLoading(true);

    // 🔑 Étape clé : Création de FormData pour l'upload de fichiers
    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('price', formData.price);
    data.append('location_address', formData.location.address);
    data.append('location_city', formData.location.city);
    data.append('location_zipCode', formData.location.zipCode);
    data.append('type', formData.type);
    data.append('amenities', formData.amenities);

    // Ajout des NOUVELLES images à l'objet FormData
    images.forEach(image => {
      data.append('images', image);
    });
    
    // Si nous sommes en mode édition et que de nouvelles images ont été sélectionnées, 
    // l'API devra gérer le remplacement ou l'ajout (selon sa logique).
    // Si aucune nouvelle image n'est sélectionnée en mode édition, l'API conserve les anciennes.
    
    try {
      let response;
      if (isEditMode) {
        // Mode modification : PUT /api/housing/:id
        response = await updateHousing(id, data);
        setMessage('Annonce modifiée avec succès !');
      } else {
        // Mode création : POST /api/housing
        response = await createHousing(data);
        setMessage('Annonce créée avec succès !');
        // Réinitialiser le formulaire après la création
        setFormData(initialFormData);
        setImages([]);
      }

      // Rediriger vers le tableau de bord après un court délai
      setTimeout(() => {
          navigate('/dashboard');
      }, 1500);

    } catch (err) {
      console.error("Erreur lors de la soumission de l'annonce :", err);
      // Récupère le message d'erreur spécifique de l'API
      const errMsg = err.response?.data?.message || `Erreur lors de ${isEditMode ? 'la modification' : 'la création'} de l'annonce.`;
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };


  if (loading && isEditMode) {
    return <p>Chargement des données de l'annonce...</p>;
  }

  return (
    <div className="create-housing-container">
      <h2>{isEditMode ? 'Modifier votre annonce' : 'Créer une nouvelle annonce'}</h2>

      <form onSubmit={handleSubmit} className="create-housing-form">
        
        {/* Champs principaux */}
        <input 
          type="text" 
          name="title" 
          placeholder="Titre de l'annonce" 
          value={formData.title} 
          onChange={handleChange} 
          required 
        />
        <textarea 
          name="description" 
          placeholder="Description détaillée" 
          value={formData.description} 
          onChange={handleChange} 
          required 
        />
        <input 
          type="number" 
          name="price" 
          placeholder="Prix par mois (€)" 
          value={formData.price} 
          onChange={handleChange} 
          required 
        />
        
        {/* Localisation */}
        <h3>Localisation</h3>
        <input 
          type="text" 
          name="city" 
          placeholder="Ville" 
          value={formData.location.city} 
          onChange={handleChange} 
          required 
        />
        <input 
          type="text" 
          name="address" 
          placeholder="Adresse" 
          value={formData.location.address} 
          onChange={handleChange} 
          required 
        />
        <input 
          type="text" 
          name="zipCode" 
          placeholder="Code postal" 
          value={formData.location.zipCode} 
          onChange={handleChange} 
          required 
        />
        
        {/* Type et équipements */}
        <label htmlFor="type">Type de logement</label>
        <select name="type" id="type" value={formData.type} onChange={handleChange}>
          <option value="chambre">Chambre</option>
          <option value="studio">Studio</option>
          <option value="T1">T1</option>
          <option value="T2">T2</option>
        </select>
        
        <input 
          type="text" 
          name="amenities" 
          placeholder="Équipements (séparés par des virgules : ex. Wifi, Lave-linge)" 
          value={formData.amenities} 
          onChange={handleChange} 
        />

        {/* Aperçu des images existantes (mode édition) */}
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