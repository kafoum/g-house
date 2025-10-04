const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { BadRequestError, NotFoundError } = require('../middleware/errorHandler');
const config = require('../config/env');

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) throw new BadRequestError('Champs requis manquants');
    const existing = await User.findOne({ email });
    if (existing) throw new BadRequestError('Cet email est déjà utilisé.', 'EMAIL_EXISTS');
    const user = new User({ name, email, password, role });
    await user.save();
    res.status(201).json({ message: 'Inscription réussie !' });
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new NotFoundError('Utilisateur non trouvé.');
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new BadRequestError('Mot de passe incorrect.', 'BAD_CREDENTIALS');
    const token = jwt.sign({ userId: user._id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
    const userData = { userId: user._id, name: user.name, email: user.email, role: user.role };
    res.json({ token, user: userData });
  } catch (e) { next(e); }
}

module.exports = { register, login };
