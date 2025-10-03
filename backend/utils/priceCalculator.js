// Calcule le nombre de jours entre deux dates (à utiliser pour la validation serveur)
const calculateTotalDays = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (startDate && endDate && endDate > startDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        // Arrondi au jour supérieur
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    }
    return 0;
};

// Le prix mensuel divisé par 30 jours pour une approximation journalière
const calculateTotalPrice = (pricePerMonth, days) => {
    if (days <= 0 || !pricePerMonth) return 0;
    const pricePerDay = pricePerMonth / 30.0; 
    // Important: utiliser toFixed(2) pour s'assurer d'avoir la bonne précision pour le paiement
    return (pricePerDay * days).toFixed(2); 
};

module.exports = {
    calculateTotalDays,
    calculateTotalPrice
};