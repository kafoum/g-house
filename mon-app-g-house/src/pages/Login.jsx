import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // 🔑 Importez le hook useAuth
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 1. Utilisez le hook useAuth pour accéder à la fonction login
  const { login } = useAuth(); 

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      // 2. Appelez la fonction login du contexte
      const user = await login(email, password); 
      
      // La fonction login gère déjà le token et l'état dans le contexte.
      setMessage('Connexion réussie !');

      // 3. Redirigez l'utilisateur en fonction du rôle renvoyé
      if (user.role === 'landlord') {
        navigate('/dashboard'); // Propriétaire : va au tableau de bord
      } else {
        navigate('/'); // Locataire : va à la page d'accueil (HousingList)
      }
      
    } catch (error) {
      // Axios Error géré dans AuthContext renvoie le message.
      const errorMessage = error.response?.data?.message || 'Erreur lors de la connexion. Vérifiez vos identifiants.';
      console.error("Erreur de connexion:", errorMessage);
      setMessage(errorMessage);
    } finally {
      setLoading(false);
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
        <button type="submit" disabled={loading}>
          {loading ? 'Connexion en cours...' : 'Se connecter'}
        </button>
      </form>
      {/* Afficher un message d'erreur en rouge, ou de succès en vert */}
      {message && <p className={`message ${message.includes('réussie') ? 'success' : 'error'}`}>{message}</p>}
      <p className="link-auth">
        Pas encore de compte ? <Link to="/register">S'inscrire</Link>
      </p>
    </div>
  );
};

export default Login;