// Fabrique d'application Express pour tests (sans lancer le serveur HTTP complet)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { errorHandler, NotFoundError, BadRequestError } = require('./middleware/errorHandler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Housing = require('./models/Housing');
const marketplaceRoutes = require('./modules/marketplace/routes');
const insuranceRoutes = require('./modules/insurance/routes');
const movingRoutes = require('./modules/moving/routes');
const bookingRoutes = require('./routes/bookingRoutes');
const housingRoutes = require('./routes/housingRoutes');
const conciergeRoutes = require('./modules/concierge/routes');

async function connectDb() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
}

module.exports = async function appFactory() {
  await connectDb();
  const app = express();
  app.use(express.json());

  const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 50 });

  app.post('/api/register', authLimiter, async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) throw new BadRequestError('Champs requis manquants');
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
      const user = new User({ name, email, password });
      await user.save();
      res.status(201).json({ message: 'Inscription réussie !' });
    } catch (e) { next(e); }
  });

  app.post('/api/login', authLimiter, async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) throw new NotFoundError('Utilisateur non trouvé.');
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ message: 'Mot de passe incorrect.' });
      const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'testsecret');
      res.json({ token });
    } catch (e) { next(e); }
  });

  // Utiliser routes complètes housing (inclut recherche radius & insights)
  app.use('/api/housing', housingRoutes);

  // Mount marketplace routes
  app.use('/api/marketplace/items', marketplaceRoutes);
  app.use('/api/insurance/policies', insuranceRoutes);
  app.use('/api/moving/requests', movingRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/concierge/requests', conciergeRoutes);

  app.use((req,res,next)=> next(new NotFoundError('Route non trouvée')));
  app.use(errorHandler);
  return app;
};
