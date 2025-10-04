require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Housing = require('./models/Housing');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI manquant');
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connexion MongoDB OK');

    // Nettoyage optionnel
    const wipe = process.argv.includes('--wipe');
    if (wipe) {
      await Promise.all([
        User.deleteMany({}),
        Housing.deleteMany({})
      ]);
      console.log('Collections User & Housing vidées');
    }

    // Utilisateurs de base
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const usersData = [
      { name: 'Alice Locataire', email: 'alice@example.com', password: passwordHash, role: 'tenant' },
      { name: 'Bob Proprio', email: 'bob@example.com', password: passwordHash, role: 'landlord' },
      { name: 'Chloe Proprio', email: 'chloe@example.com', password: passwordHash, role: 'landlord' }
    ];

    const existingUsers = await User.find({ email: { $in: usersData.map(u => u.email) } }).select('email');
    const existingEmails = new Set(existingUsers.map(u => u.email));

    const toInsert = usersData.filter(u => !existingEmails.has(u.email));
    if (toInsert.length) {
      await User.insertMany(toInsert);
      console.log(`Utilisateurs insérés: ${toInsert.length}`);
    } else {
      console.log('Utilisateurs déjà présents, pas d\'insertion.');
    }

    const landlords = await User.find({ role: 'landlord' });
    if (!landlords.length) throw new Error('Aucun propriétaire trouvé pour créer des logements.');

    // Logements seed (un par propriétaire si pas existant)
    for (const landlord of landlords) {
      const exists = await Housing.findOne({ landlord: landlord._id });
      if (exists) continue;
      await Housing.create({
        title: `Logement de ${landlord.name.split(' ')[0]}`,
        description: 'Bel espace lumineux proche des commodités.',
        price: 1200,
        location: { address: '1 rue de Test', city: 'Paris', zipCode: '75000' },
        type: 'T2',
        amenities: ['wifi', 'chauffage', 'meublé'],
        landlord: landlord._id,
        images: []
      });
      console.log(`Logement créé pour ${landlord.email}`);
    }

    console.log('Seed terminé.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (e) {
    console.error('Erreur seed:', e);
    process.exit(1);
  }
})();
