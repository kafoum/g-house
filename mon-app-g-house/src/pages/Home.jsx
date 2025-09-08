import React from 'react';

const Home = ({ authToken }) => {
  const user = JSON.parse(localStorage.getItem('user'));

  return (
    <div>
      <h1>Bienvenue sur G-House !</h1>
      {authToken ? (
        <>
          <p>Vous êtes connecté en tant que {user?.name} ({user?.role}).</p>
          <p>Explorez les annonces de logements et gérez votre compte.</p>
        </>
      ) : (
        <p>Veuillez vous inscrire ou vous connecter pour accéder à toutes les fonctionnalités.</p>
      )}
    </div>
  );
};

export default Home;