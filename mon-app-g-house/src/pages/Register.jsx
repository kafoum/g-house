import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'tenant', // Valeur par défaut
  });

  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://g-house-api.onrender.com/api/register', formData);
      setMessage(response.data.message);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Erreur lors de l\'inscription.');
    }
  };

  return (
    <div>
      <h2>Inscription</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Nom :</label>
          <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="email">Email :</label>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="password">Mot de passe :</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="new-password" // <-- Ajouté ici
          />
        </div>
        <div>
          <label htmlFor="role">Rôle :</label>
          <select id="role" name="role" value={formData.role} onChange={handleChange}>
            <option value="tenant">Locataire</option>
            <option value="landlord">Propriétaire</option>
          </select>
        </div>
        <button type="submit">S'inscrire</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Register;