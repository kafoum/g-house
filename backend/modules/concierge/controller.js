const ConciergeRequest = require('./ConciergeRequest');
const ProfileDoc = require('../../models/ProfileDoc');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../middleware/errorHandler');
const { emit } = require('../../events/bus');

function computeUpfront(budgetMonthly, depositBudget){
  const base = budgetMonthly + depositBudget;
  const tenPercent = base * 0.10;
  return Math.max(50, Math.round(tenPercent));
}

async function snapshotDocs(userId){
  const docs = await ProfileDoc.find({ user: userId });
  const set = new Set(docs.map(d=> d.docType));
  return {
    identity_card: set.has('identity_card'),
    visale_guarantee: set.has('visale_guarantee'),
    proof_of_income: set.has('proof_of_income'),
    proof_of_address: set.has('proof_of_address')
  };
}

exports.createConcierge = async (req,res,next) => {
  try {
    if (req.role !== 'tenant') throw new ForbiddenError('Réservé aux locataires.');
    const { budgetMonthly, depositBudget, desiredTypes = [], zone } = req.body;
    if (!zone) throw new BadRequestError('Zone requise');
    const docsSnapshot = await snapshotDocs(req.userId);
    const upfrontDeposit = computeUpfront(budgetMonthly, depositBudget);
    const cr = await ConciergeRequest.create({
      user: req.userId,
      budgetMonthly,
      depositBudget,
      desiredTypes,
      zonePoint: { type: 'Point', coordinates: [ zone.lon, zone.lat ] },
      zoneRadiusKm: zone.radiusKm,
      upfrontDeposit,
      docsSnapshot
    });
    emit('concierge.request.created', { id: cr._id.toString(), user: req.userId, budgetMonthly }, { traceId: req.id });
    res.status(201).json({ request: cr });
  } catch (e) { next(e); }
};

exports.listMyConcierge = async (req,res,next) => {
  try {
    const list = await ConciergeRequest.find({ user: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json({ data: list });
  } catch (e) { next(e); }
};

exports.getConcierge = async (req,res,next) => {
  try {
    const cr = await ConciergeRequest.findById(req.params.id);
    if (!cr || String(cr.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    res.json({ request: cr });
  } catch (e) { next(e); }
};

// Suggestions de logements basées sur budget et zone
exports.suggestions = async (req,res,next) => {
  try {
    const cr = await ConciergeRequest.findById(req.params.id);
    if (!cr || String(cr.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    const Housing = require('../../models/Housing');
    const priceMax = cr.budgetMonthly;
    const typesFilter = cr.desiredTypes && cr.desiredTypes.length ? { type: { $in: cr.desiredTypes } } : {};
    const geo = cr.zonePoint?.coordinates && cr.zonePoint.coordinates.length === 2 ? {
      locationPoint: {
        $near: {
          $geometry: { type: 'Point', coordinates: cr.zonePoint.coordinates },
          $maxDistance: cr.zoneRadiusKm * 1000
        }
      }
    } : {};
    const query = { status: 'active', price: { $lte: priceMax }, ...typesFilter, ...geo };
    const list = await Housing.find(query).limit(30).sort({ price: 1 });
    res.json({ count: list.length, data: list });
  } catch (e) { next(e); }
};

// Mise à jour du statut d'une demande concierge
exports.updateStatus = async (req,res,next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['in_progress','matched','closed'];
    if (!allowed.includes(status)) throw new BadRequestError('Statut invalide');
    const cr = await ConciergeRequest.findById(id);
    if (!cr || String(cr.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    cr.status = status;
    await cr.save();
    emit('concierge.request.statusUpdated', { id: cr._id.toString(), status }, { traceId: req.id });
    res.json({ request: cr });
  } catch (e) { next(e); }
};
