import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/login', { email, password });
      setMessage(response.data.message);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('role', response.data.role);

      // Redirige l'utilisateur en fonction de son rôle
      if (response.data.role === 'landlord') {
        navigate('/dashboard');
      } else {
        navigate('/'); // Redirige les locataires vers la page d'accueil
      }
    } catch (error) {
      console.error(error);
      setMessage(error.response.data.message || 'Erreur lors de la connexion.');
    }
  };

  return (
    <div className="auth-container">
      <h2>Connexion</h2>
      <form onSubmit={handleLogin} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Se connecter</button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default Login;