const express = require('express');
const auth = require('../middleware/auth');
const { startConversation, listConversations, getConversationMessages, getConversation } = require('../controllers/conversationController');
const { validate } = require('../validation/validate');
const { conversationStartSchema } = require('../validation/schemas');

const router = express.Router();

router.post('/start', auth, validate({ body: conversationStartSchema }), startConversation);
router.get('/', auth, listConversations);
router.get('/:id/messages', auth, getConversationMessages);
router.get('/:id', auth, getConversation);

module.exports = router;
