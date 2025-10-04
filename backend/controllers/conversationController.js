const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../middleware/errorHandler');

async function startConversation(req, res, next) {
  try {
    const { housingId, recipientId } = req.body;
    if (recipientId === req.userId) throw new BadRequestError('Impossible de converser avec soi-même');
    let conversation = await Conversation.findOne({ housing: housingId, participants: { $all: [req.userId, recipientId] } });
    if (!conversation) {
      conversation = await Conversation.create({ housing: housingId, participants: [req.userId, recipientId] });
    }
    res.json({ conversation });
  } catch (e) { next(e); }
}

async function listConversations(req, res, next) {
  try {
    const conversations = await Conversation.find({ participants: req.userId })
      .populate('participants', 'name')
      .populate('housing', 'title')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
    res.json({ conversations });
  } catch (e) { next(e); }
}

async function getConversationMessages(req, res, next) {
  try {
    const conversationId = req.params.id;
    const conversation = await Conversation.findOne({ _id: conversationId, participants: req.userId });
    if (!conversation) throw new ForbiddenError('Accès refusé à cette conversation.');
    const messages = await Message.find({ conversation: conversationId }).populate('sender', 'name').sort({ createdAt: 1 });
    res.json({ messages });
  } catch (e) { next(e); }
}

async function getConversation(req, res, next) {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.userId })
      .populate('participants', '_id name role')
      .populate('housing', 'title');
    if (!conversation) throw new NotFoundError('Conversation non trouvée ou accès refusé.');
    res.json({ conversation });
  } catch (e) { next(e); }
}

module.exports = { startConversation, listConversations, getConversationMessages, getConversation };
