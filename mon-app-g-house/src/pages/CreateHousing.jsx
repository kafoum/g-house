import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CreateHousing = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        location: {
            city: '',
            address: ''
        },
        price: '',
        housing_type: '',
        number_of_rooms: '',
        number_of_tenants: '',
        amenities: [],
        images: []
    });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'city' || name === 'address') {
            setFormData(prev => ({
                ...prev,
                location: {
                    ...prev.location,
                    [name]: value
                }
            }));
        } else if (name === 'amenities') {
            const options = e.target.options;
            const values = [];
            for (let i = 0, l = options.length; i < l; i++) {
                if (options[i].selected) {
                    values.push(options[i].value);
                }
            }
            setFormData(prev => ({ ...prev, amenities: values }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleImageChange = (e) => {
        setSelectedImages(Array.from(e.target.files));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const data = new FormData();
            for (const key in formData) {
                if (key === 'location') {
                    data.append('location_city', formData.location.city);
                    data.append('location_address', formData.location.address);
                } else if (key === 'amenities') {
                    formData.amenities.forEach(amenity => data.append('amenities', amenity));
                } else {
                    data.append(key, formData[key]);
                }
            }
            selectedImages.forEach(image => {
                data.append('images', image);
            });

            const token = localStorage.getItem('token');
            await axios.post('https://g-house-api.onrender.com/api/housing', data, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setMessage({ text: 'Annonce créée avec succès!', type: 'success' });
            setTimeout(() => {
                navigate('/manage-housing');
            }, 2000);
        } catch (error) {
            console.error(error);
            setMessage({ text: 'Erreur lors de la création de l\'annonce. Veuillez réessayer.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen flex items-center justify-center py-12 px-4">
            <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl p-8">
                <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-6">
                    Créer une nouvelle annonce
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            required
                            rows="4"
                            className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        ></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700">Ville</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.location.city}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Adresse</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.location.address}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="price" className="block text-sm font-medium text-gray-700">Prix par mois (€)</label>
                        <input
                            type="number"
                            name="price"
                            value={formData.price}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="housing_type" className="block text-sm font-medium text-gray-700">Type de logement</label>
                            <select
                                name="housing_type"
                                value={formData.housing_type}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Sélectionner</option>
                                <option value="apartment">Appartement</option>
                                <option value="house">Maison</option>
                                <option value="studio">Studio</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="number_of_rooms" className="block text-sm font-medium text-gray-700">Nombre de pièces</label>
                            <input
                                type="number"
                                name="number_of_rooms"
                                value={formData.number_of_rooms}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="number_of_tenants" className="block text-sm font-medium text-gray-700">Nombre de locataires</label>
                            <input
                                type="number"
                                name="number_of_tenants"
                                value={formData.number_of_tenants}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="amenities" className="block text-sm font-medium text-gray-700">Équipements (maintenez Ctrl/Cmd pour sélectionner plusieurs)</label>
                        <select
                            name="amenities"
                            value={formData.amenities}
                            onChange={handleChange}
                            multiple
                            className="mt-1 block w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32"
                        >
                            <option value="Wifi">Wifi</option>
                            <option value="Parking">Parking</option>
                            <option value="Machine à laver">Machine à laver</option>
                            <option value="Climatisation">Climatisation</option>
                            <option value="Balcon">Balcon</option>
                            <option value="Jardin">Jardin</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="images" className="block text-sm font-medium text-gray-700">Images du logement</label>
                        <input
                            type="file"
                            name="images"
                            onChange={handleImageChange}
                            multiple
                            required
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                    >
                        {loading ? 'Création en cours...' : 'Créer l\'annonce'}
                    </button>
                </form>

                {message.text && (
                    <div className={`mt-6 p-4 rounded-xl text-center ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateHousing;