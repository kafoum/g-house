import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // 🔑 Importez le hook useAuth
import './Auth.css'; // Pour les styles

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'tenant' // Rôle par défaut
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 1. Utilisez le hook useAuth pour accéder à la fonction register (qui contient l'appel API)
  const { register } = useAuth(); 

  // --- Gestion des changements de formulaire ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // --- Gestion de la soumission du formulaire ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);

    try {
      // 2. Appelez la fonction register du contexte
      await register(formData); 
      
      setMessage('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      
      // 3. Redirigez l'utilisateur vers la page de connexion après l'inscription réussie
      setTimeout(() => {
        navigate('/login');
      }, 2000); 

    } catch (error) {
      // Erreur de l'API (ex: email déjà utilisé)
      const errorMessage = error.response?.data?.message || "Erreur lors de l'inscription. Veuillez réessayer.";
      console.error("Erreur d'inscription:", errorMessage);
      setMessage(errorMessage);
    } finally {
      setLoading(false);
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
        
        <label htmlFor="role-select">Je suis :</label>
        <select 
          id="role-select" 
          name="role" 
          value={formData.role} 
          onChange={handleChange}
        >
          <option value="tenant">Locataire</option>
          <option value="landlord">Propriétaire</option>
        </select>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Inscription en cours...' : "S'inscrire"}
        </button>
      </form>
      
      {/* Afficher un message d'erreur ou de succès */}
      {message && <p className={`message ${message.includes('réussie') ? 'success' : 'error'}`}>{message}</p>}
      
      <p className="link-auth">
        Déjà un compte ? <Link to="/login">Se connecter</Link>
      </p>
    </div>
  );
};

export default Register;