const MarketplaceItem = require('./MarketplaceItem');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../../middleware/errorHandler');
const { emit } = require('../../events/bus');

const PLATFORM_FEE = parseFloat(process.env.MARKETPLACE_PLATFORM_FEE || '5');

function computeTotal(priceUser) { return priceUser + PLATFORM_FEE; }

async function createItem(req, res, next) {
  try {
    const { title, description, category, condition, priceUser, images = [] } = req.body;
    const totalPrice = computeTotal(priceUser);
    const item = await MarketplaceItem.create({
      owner: req.userId,
      title, description, category,
      condition: condition || 'used',
      priceUser,
      platformFee: PLATFORM_FEE,
      totalPrice,
      images
    });
  emit('marketplace.item.created', { id: item._id.toString(), owner: req.userId, totalPrice }, { traceId: req.id });
    res.status(201).json({ item });
  } catch (e) { next(e); }
}

async function listItems(req, res, next) {
  try {
    const { category, status, page = 1, limit = 10 } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    else filters.status = 'active';
    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 50);
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
      MarketplaceItem.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limitNum).populate('owner','name'),
      MarketplaceItem.countDocuments(filters)
    ]);
    res.json({ data: items, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total/limitNum)||1 } });
  } catch (e) { next(e); }
}

async function getItem(req, res, next) {
  try {
    const item = await MarketplaceItem.findById(req.params.id).populate('owner','name').populate('reservedBy','name');
    if (!item) throw new NotFoundError('Item non trouvé');
    res.json({ item });
  } catch (e) { next(e); }
}

async function reserveItem(req, res, next) {
  try {
    const item = await MarketplaceItem.findById(req.params.id);
    if (!item) throw new NotFoundError('Item non trouvé');
    if (item.status !== 'active') throw new BadRequestError('Item non réservable');
    if (item.owner.toString() === req.userId) throw new ForbiddenError('Impossible de réserver votre propre item');
    item.status = 'reserved';
    item.reservedBy = req.userId;
  await item.save();
  emit('marketplace.item.reserved', { id: item._id.toString(), reservedBy: req.userId }, { traceId: req.id });
    res.json({ message: 'Réservé.', item });
  } catch (e) { next(e); }
}

async function completeItem(req, res, next) {
  try {
    const item = await MarketplaceItem.findById(req.params.id);
    if (!item) throw new NotFoundError('Item non trouvé');
    if (item.status !== 'reserved') throw new BadRequestError('Item non en statut réservé');
    if (item.reservedBy?.toString() !== req.userId && item.owner.toString() !== req.userId) {
      throw new ForbiddenError('Seul le réservataire ou le propriétaire peut finaliser');
    }
    item.status = 'given';
    item.archivedAt = new Date();
  await item.save();
  emit('marketplace.item.given', { id: item._id.toString() }, { traceId: req.id });
    res.json({ message: 'Transfert finalisé.', item });
  } catch (e) { next(e); }
}

async function cancelItem(req, res, next) {
  try {
    const item = await MarketplaceItem.findById(req.params.id);
    if (!item) throw new NotFoundError('Item non trouvé');
    if (item.owner.toString() !== req.userId) throw new ForbiddenError('Non propriétaire');
    if (!['active','reserved'].includes(item.status)) throw new BadRequestError('Statut non annulable');
    item.status = 'cancelled';
    item.archivedAt = new Date();
  await item.save();
  emit('marketplace.item.cancelled', { id: item._id.toString() }, { traceId: req.id });
    res.json({ message: 'Annonce annulée.', item });
  } catch (e) { next(e); }
}

module.exports = { createItem, listItems, getItem, reserveItem, completeItem, cancelItem };
