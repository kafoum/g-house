// Calcule le nombre de jours entre deux dates (à utiliser pour la validation serveur)
const calculateTotalDays = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate) || isNaN(endDate)) return 0;
    if (endDate <= startDate) return 0;
    const diffTime = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Prix mensuel approximé réparti sur 30 jours
const calculateTotalPrice = (pricePerMonth, days) => {
    if (days <= 0 || !pricePerMonth) return 0;
    const pricePerDay = pricePerMonth / 30.0;
    const total = pricePerDay * days;
    return Number(total.toFixed(2)); // retourne un nombre, pas une string
};

// Fonction utilisée dans index.js pour Stripe (montant en centimes)
const calculatePrice = (pricePerMonth, startDate, endDate) => {
    const days = calculateTotalDays(startDate, endDate);
    const total = calculateTotalPrice(pricePerMonth, days);
    // Stripe attend des entiers en plus petite unité (cents)
    return Math.round(total * 100);
};

// Nouvelle logique de réservation : montant = (loyer + caution) + commission
// commission = taux * (loyer + caution). Retourne un objet détaillé.
const calculateReservationBreakdown = ({ monthlyRent, deposit = 0, commissionRate = 0.4 }) => {
    const base = Number(monthlyRent || 0) + Number(deposit || 0);
    const commission = +(base * commissionRate).toFixed(2);
    const total = +(base + commission).toFixed(2);
    return { baseRent: Number(monthlyRent), deposit: Number(deposit), commissionRate, commission, total };
};

module.exports = {
    calculateTotalDays,
    calculateTotalPrice,
    calculatePrice,
    calculateReservationBreakdown,
};