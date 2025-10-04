const express = require('express');
const auth = require('../../middleware/auth');
const { validate } = require('../../validation/validate');
const { createConciergeSchema } = require('./schemas');
const { createConcierge, listMyConcierge, getConcierge, suggestions, updateStatus } = require('./controller');

const router = express.Router();

router.post('/', auth, validate({ body: createConciergeSchema }), createConcierge);
router.get('/me', auth, listMyConcierge);
router.get('/:id', auth, getConcierge);
router.get('/:id/suggestions', auth, suggestions);
router.patch('/:id/status', auth, updateStatus);

module.exports = router;
