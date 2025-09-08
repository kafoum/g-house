import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = ({ setAuthToken }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('https://g-house-api.onrender.com/api/login', formData);
      const { token, user } = response.data;
      // Stocke le token dans le localStorage pour les futures requêtes
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      // Met à jour l'état d'authentification dans l'application principale
      setAuthToken(token);
      setMessage('Connexion réussie !');
      // Redirection après une connexion réussie
      setTimeout(() => {
        navigate('/'); // Redirection vers la page d'accueil
      }, 1500);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Email ou mot de passe incorrect.');
    }
  };

  return (
    <div>
      <h2>Connexion</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email :</label>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>
        <div>
          <label htmlFor="password">Mot de passe :</label>
          <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required />
        </div>
        <button type="submit">Se connecter</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Login;
