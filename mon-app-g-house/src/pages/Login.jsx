import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api'; // Importez l'instance Axios personnalisée

const Login = ({ setAuthToken, setUserRole, setUserName }) => {
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
      // Utilisez l'instance "api" pour la requête
      const response = await api.post('/login', formData);
      const { token, user } = response.data;
      
      // Stocke le token et les informations de l'utilisateur dans le localStorage
      localStorage.setItem('token', token);
      
      // Met à jour l'état d'authentification dans l'application principale
      setAuthToken(token);
      setUserRole(user.role);
      setUserName(user.name);
      
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
