import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [housing, setHousing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHousing = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/housing`);
        if (!response.ok) {
          throw new Error('Erreur de réseau ou de serveur.');
        }
        const data = await response.json();
        setHousing(data.housing);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHousing();
  }, []);

  if (loading) return <div className="loading-message">Chargement des logements...</div>;
  if (error) return <div className="error-message">Erreur : {error}</div>;

  return (
    <div className="container">
      <h1>Annonces de Logements</h1>
      <div className="housing-list">
        {housing.length > 0 ? (
          housing.map((item) => (
            <div key={item._id} className="housing-item">
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <p><strong>Prix :</strong> {item.price} €</p>
              <p><strong>Ville :</strong> {item.location.city}</p>
            </div>
          ))
        ) : (
          <p>Aucun logement à afficher pour le moment.</p>
        )}
      </div>
    </div>
  );
}

export default App;