import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// 🔑 Importez les fonctions API dédiées
import { getUserHousing, deleteHousing } from '../api/api'; 
// import axios from 'axios'; // Peut être supprimé si non utilisé ailleurs

const ManageHousing = ({ onHousingDeleted }) => { // onHousingDeleted est optionnel
    // ... (déclarations useState et navigate)

    const fetchUserHousing = async () => {
        setLoading(true);
        // Suppression de la récupération manuelle du token
        
        try {
            // 🔑 Utilisez la fonction API dédiée : le token est géré dans api.js
            const response = await getUserHousing(); 
            setHousingList(response.data.housing);
        } catch (error) {
            setMessage('Erreur lors de la récupération des annonces.');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // ... (useEffect)

    const handleDelete = async (id) => {
        const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette annonce ?");
        if (!confirmDelete) {
            return;
        }
        
        // Suppression de la récupération manuelle du token

        try {
            // 🔑 Utilisez la fonction API dédiée : le token est géré dans api.js
            await deleteHousing(id); 
            
            setMessage('Annonce supprimée avec succès !');
            setHousingList(currentList => currentList.filter(h => h._id !== id));
            if (onHousingDeleted) {
                onHousingDeleted(id); // Optionnel, si utilisé par Dashboard
            }
        } catch (error) {
            setMessage("Erreur lors de la suppression de l'annonce.");
            console.error(error);
        }
    };

    const handleEdit = (id) => {
        navigate(`/edit-housing/${id}`);
    };

    // ... (Reste du rendu)
};

export default ManageHousing;