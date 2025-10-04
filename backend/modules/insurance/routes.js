const express = require('express');
const auth = require('../../middleware/auth');
const { validate } = require('../../validation/validate');
const { createPolicySchema, listPoliciesQuery } = require('./schemas');
const { createPolicy, listPolicies, getPolicy, cancelPolicy } = require('./controller');

const router = express.Router();

router.post('/', auth, validate({ body: createPolicySchema }), createPolicy);
router.get('/', auth, validate({ query: listPoliciesQuery }), listPolicies);
router.get('/:id', auth, getPolicy);
router.post('/:id/cancel', auth, cancelPolicy);

module.exports = router;
