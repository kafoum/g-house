import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
          // L'intercepteur Axios ajoute le token, mais cette route GET est publique.
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
            // Convertit le tableau d'équipements en chaîne de caractères pour le formulaire
            amenities: housing.amenities.join(', ')
          });
          // Stocke les URLs des images existantes pour l'affichage (si besoin)
          setExistingImages(housing.images || []);
          
        } catch (err) {
          console.error("Erreur lors du chargement de l'annonce :", err);
          setError("Erreur lors du chargement de l'annonce pour la modification.");
        } finally {
          setLoading(false);
        }
      };
      fetchHousingData();
    }
  }, [id, isEditMode]);


  // --- Gestion des changements de formulaire ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Gère les champs imbriqués (location.city, location.address, etc.)
    if (name in formData.location) {
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [name]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Gère la sélection des fichiers image
  const handleFileChange = (e) => {
    // Stocke la liste des fichiers sélectionnés par l'utilisateur
    setImages(Array.from(e.target.files));
  };


  // --- Soumission du formulaire ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    setLoading(true);

    try {
      // 1. Préparation de FormData pour l'envoi de données et de fichiers
      const formToSend = new FormData();
      
      // Ajout des champs de données de base
      formToSend.append('title', formData.title);
      formToSend.append('description', formData.description);
      formToSend.append('price', formData.price);
      formToSend.append('type', formData.type);
      
      // Les équipements sont envoyés sous forme de tableau (séparé par des virgules)
      formToSend.append('amenities', formData.amenities); 
      
      // Ajout des données de localisation
      formToSend.append('location.address', formData.location.address);
      formToSend.append('location.city', formData.location.city);
      formToSend.append('location.zipCode', formData.location.zipCode);
      
      // Ajout des fichiers image
      images.forEach(file => {
        // Le nom du champ doit correspondre à celui attendu par Multer/Cloudinary (e.g., 'images')
        formToSend.append('images', file); 
      });

      // 2. Appel à l'API (Création ou Modification)
      if (isEditMode) {
        // En mode édition, les images existantes ne sont pas renvoyées. 
        // L'API ne gère que l'ajout ou le remplacement des NOUVELLES images.
        await updateHousing(id, formToSend);
        setMessage("Annonce modifiée avec succès ! Redirection...");
      } else {
        await createHousing(formToSend);
        setMessage("Annonce créée avec succès ! Redirection...");
      }
      
      // 3. Redirection vers le tableau de bord après succès
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500); 

    } catch (err) {
      // Axios place l'erreur dans error.response pour les statuts HTTP 4xx/5xx
      const errorMessage = err.response?.data?.message || `Erreur lors de ${isEditMode ? 'la modification' : 'la création'} de l'annonce.`;
      setError(errorMessage);
      console.error(errorMessage, err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return <p>Chargement des données de l'annonce...</p>;
  }

  return (
    <div className="create-housing-container">
      <h1>{isEditMode ? `Modifier : ${formData.title}` : 'Créer une nouvelle annonce'}</h1>
      
      <form onSubmit={handleSubmit} className="create-housing-form">
        
        {/* Champs de base */}
        <input type="text" name="title" placeholder="Titre de l'annonce" value={formData.title} onChange={handleChange} required />
        <textarea name="description" placeholder="Description détaillée" value={formData.description} onChange={handleChange} required />
        <input type="number" name="price" placeholder="Prix par mois (en €)" value={formData.price} onChange={handleChange} required />
        
        {/* Type de logement */}
        <label htmlFor="type">Type de logement</label>
        <select name="type" id="type" value={formData.type} onChange={handleChange}>
          <option value="chambre">Chambre</option>
          <option value="studio">Studio</option>
          <option value="T1">T1</option>
          <option value="T2">T2</option>
        </select>
        
        {/* Localisation */}
        <h3>Localisation</h3>
        <input type="text" name="city" placeholder="Ville" value={formData.location.city} onChange={handleChange} required />
        <input type="text" name="address" placeholder="Adresse complète" value={formData.location.address} onChange={handleChange} required />
        <input type="text" name="zipCode" placeholder="Code postal" value={formData.location.zipCode} onChange={handleChange} required />
        
        {/* Équipements */}
        <input type="text" name="amenities" placeholder="Équipements (séparés par des virgules : Wifi, Parking, Balcon)" value={formData.amenities} onChange={handleChange} />
        
        {/* Images existantes (uniquement en mode édition) */}
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
        <input type="file" name="images" id="images" onChange={handleFileChange} multiple accept="image/*" />
        
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