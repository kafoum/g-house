// Fichier : frontend/src/components/TenantDocUploader.jsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { uploadProfileDoc, getMyProfileDocs } from '../api/api';

// Types de documents requis par le schéma ProfileDoc.js
const REQUIRED_DOC_TYPES = [
    'identity_card', 
    'proof_of_address', 
    'visale_guarantee', 
    'proof_of_income'
];

const DOC_LABELS = {
    identity_card: "Carte d'identité / Passeport",
    proof_of_address: "Justificatif de domicile",
    visale_guarantee: "Garantie Visale (ou autre)",
    proof_of_income: "Justificatif de revenus"
};

const TenantDocUploader = () => {
    const { user } = useAuth();
    const [docs, setDocs] = useState([]);
    const [file, setFile] = useState(null);
    const [docType, setDocType] = useState(REQUIRED_DOC_TYPES[0]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // 1. Chargement initial des documents existants
    const fetchDocs = async () => {
        if (!user || user.role !== 'tenant') return;
        try {
            const response = await getMyProfileDocs();
            setDocs(response.data.documents);
        } catch (err) {
            console.error("Erreur de chargement des documents:", err);
            // On peut ignorer l'erreur si c'est juste la première connexion
        }
    };

    useEffect(() => {
        fetchDocs();
    }, [user]);

    // 2. Gestion de l'upload
    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !docType) {
            setMessage({ type: 'error', text: 'Veuillez sélectionner un type de document et un fichier.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await uploadProfileDoc(docType, file);
            setMessage({ type: 'success', text: `${DOC_LABELS[docType]} téléchargé avec succès !` });
            setFile(null); // Réinitialiser le fichier
            fetchDocs(); // Recharger la liste
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Erreur lors du téléchargement du document.';
            setMessage({ type: 'error', text: errorMsg });
            console.error("Erreur d'upload:", err);
        } finally {
            setLoading(false);
        }
    };

    // 3. Rendu
    const uploadedTypes = docs.map(d => d.docType);
    const missingTypes = REQUIRED_DOC_TYPES.filter(type => !uploadedTypes.includes(type));

    if (user.role !== 'tenant') {
        return null;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mt-6 border">
            <h3 className="text-2xl font-semibold mb-4 text-gray-800">Mes Documents de Profil</h3>
            
            {/* Aperçu des documents existants */}
            <div className="mb-4">
                <p className="font-medium mb-2">Statut : {missingTypes.length === 0 ? 
                    <span className="text-green-600 font-bold">✅ Profil complet</span> : 
                    <span className="text-orange-600 font-bold">⚠️ {missingTypes.length} documents manquants</span>
                }</p>
                <ul className="list-disc list-inside text-sm text-gray-600">
                    {REQUIRED_DOC_TYPES.map(type => (
                        <li key={type} className={uploadedTypes.includes(type) ? 'text-green-700' : 'text-red-700'}>
                            {DOC_LABELS[type]} : {uploadedTypes.includes(type) ? 'Téléchargé' : 'Manquant'}
                        </li>
                    ))}
                </ul>
            </div>

            <hr className="my-4"/>

            {/* Formulaire de téléchargement */}
            <form onSubmit={handleUpload} className="space-y-4">
                <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                    <div className="flex-1">
                        <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700">Type de document</label>
                        <select 
                            id="doc-type"
                            value={docType}
                            onChange={(e) => setDocType(e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            {REQUIRED_DOC_TYPES.map(type => (
                                <option key={type} value={type} disabled={uploadedTypes.includes(type)}>
                                    {DOC_LABELS[type]} {uploadedTypes.includes(type) ? '(Déjà présent)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="doc-file" className="block text-sm font-medium text-gray-700">Fichier (PDF, JPG, PNG)</label>
                        <input
                            id="doc-file"
                            type="file"
                            onChange={(e) => setFile(e.target.files[0])}
                            accept=".pdf,.jpg,.jpeg,.png"
                            required
                            className="mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                        />
                    </div>
                </div>

                {message && (
                    <p className={`text-sm font-medium ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                        {message.text}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={loading || !file || uploadedTypes.includes(docType)}
                    className="w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                    {loading ? 'Téléchargement...' : `Télécharger ${DOC_LABELS[docType]}`}
                </button>
            </form>
        </div>
    );
};

export default TenantDocUploader;