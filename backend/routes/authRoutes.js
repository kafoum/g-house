const express = require('express');
const { register, login } = require('../controllers/authController');
const { validate } = require('../validation/validate');
const { registerSchema, loginSchema } = require('../validation/schemas');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);

module.exports = router;
