const express = require('express');
const auth = require('../../middleware/auth');
const { validate } = require('../../validation/validate');
const { createItemSchema, listQuerySchema } = require('./schemas');
const { createItem, listItems, getItem, reserveItem, completeItem, cancelItem } = require('./controller');

const router = express.Router();

router.get('/', validate({ query: listQuerySchema }), listItems);
router.get('/:id', getItem);
router.post('/', auth, validate({ body: createItemSchema }), createItem);
router.post('/:id/reserve', auth, reserveItem);
router.post('/:id/complete', auth, completeItem);
router.post('/:id/cancel', auth, cancelItem);

module.exports = router;
