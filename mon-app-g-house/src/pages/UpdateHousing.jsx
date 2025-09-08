import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

const UpdateHousing = () => {
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
    const [newImages, setNewImages] = useState([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { id } = useParams();

    useEffect(() => {
        const fetchHousingData = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setMessage('Vous devez être connecté pour modifier une annonce.');
                setLoading(false);
                return;
            }
            try {
                const response = await axios.get(`https://g-house-api.onrender.com/api/housing/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                const housing = response.data.housing;
                setFormData({
                    title: housing.title,
                    description: housing.description,
                    type: housing.type,
                    price: housing.price,
                    location: housing.location,
                    amenities: housing.amenities.join(', '),
                    images: housing.images,
                });
                setLoading(false);
            } catch (error) {
                setMessage(error.response?.data?.message || 'Erreur lors de la récupération de l\'annonce.');
                setLoading(false);
                console.error(error);
            }
        };

        fetchHousingData();
    }, [id]);

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

    const handleNewImageChange = (e) => {
        setNewImages(Array.from(e.target.files));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        const token = localStorage.getItem('token');
        const dataToSend = new FormData();

        dataToSend.append('title', formData.title);
        dataToSend.append('description', formData.description);
        dataToSend.append('type', formData.type);
        dataToSend.append('price', formData.price);
        dataToSend.append('location', JSON.stringify(formData.location));
        dataToSend.append('amenities', formData.amenities);

        newImages.forEach(image => {
            dataToSend.append('images', image);
        });

        try {
            await axios.put(`https://g-house-api.onrender.com/api/housing/${id}`, dataToSend, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            setMessage('Annonce modifiée avec succès !');
            setTimeout(() => {
                navigate('/manage-housing');
            }, 2000);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Erreur lors de la modification de l\'annonce.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <p>Chargement des données de l'annonce...</p>;
    }

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
                
                <h3>Images</h3>
                {formData.images.length > 0 && (
                    <div>
                        <h4>Images actuelles :</h4>
                        {formData.images.map((image, index) => (
                            <img key={index} src={image} alt={`Image ${index + 1}`} style={{ width: '100px', height: '100px', margin: '5px' }} />
                        ))}
                    </div>
                )}

                <div>
                    <label htmlFor="newImages">Télécharger de nouvelles images (remplacera les anciennes) :</label>
                    <input type="file" id="newImages" name="newImages" multiple onChange={handleNewImageChange} accept="image/*" />
                </div>
                
                <button type="submit" disabled={loading}>
                    {loading ? 'Modification en cours...' : 'Modifier l\'annonce'}
                </button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default UpdateHousing;