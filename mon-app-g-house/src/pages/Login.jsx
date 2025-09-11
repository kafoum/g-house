import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api'; // Importez l'instance Axios personnalisée
import { jwtDecode } from 'jwt-decode';

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
      const response = await api.post('/login', formData);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      
      const decodedToken = jwtDecode(token);
      setAuthToken(token);
      setUserRole(decodedToken.role);
      setUserName(decodedToken.name);
      
      setMessage('Connexion réussie !');
      
      setTimeout(() => {
        navigate('/');
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
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
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
            autoComplete="current-password" // <-- Ajouté ici
          />
        </div>
        <button type="submit">Se connecter</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Login;