import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'tenant'
  });
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/register', formData);
      setMessage(response.data.message);
      // Redirige l'utilisateur vers la page de connexion après l'inscription réussie
      navigate('/login');
    } catch (error) {
      console.error(error);
      setMessage(error.response.data.message || 'Erreur lors de l\'inscription.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Inscription</h2>
      <form onSubmit={handleRegister} className="auth-form">
        <input
          type="text"
          name="name"
          placeholder="Nom"
          value={formData.name}
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          value={formData.password}
          onChange={handleChange}
          required
        />
        <select name="role" value={formData.role} onChange={handleChange}>
          <option value="tenant">Locataire</option>
          <option value="landlord">Propriétaire</option>
        </select>
        <button type="submit">S'inscrire</button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default Register;