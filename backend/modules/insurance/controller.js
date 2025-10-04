const InsurancePolicy = require('./InsurancePolicy');
const Housing = require('../../models/Housing');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../middleware/errorHandler');
const { emit } = require('../../events/bus');

exports.createPolicy = async (req,res,next) => {
  try {
    const { housing, provider, coverageType, startDate, endDate, priceMonthly, currency } = req.body;
    const housingDoc = await Housing.findById(housing);
    if (!housingDoc) throw new NotFoundError('Logement introuvable');
    if (String(housingDoc.landlord) !== String(req.userId)) throw new ForbiddenError('Vous devez être le propriétaire du logement');

    // Check overlapping active or pending policies for the period
    const overlap = await InsurancePolicy.findOne({
      housing,
      status: { $in: ['active','pending'] },
      $or: [
        { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(startDate) } }
      ]
    });
    if (overlap) throw new BadRequestError('Une police existe déjà sur cette période');

    const policy = await InsurancePolicy.create({
      user: req.userId,
      housing,
      provider,
      coverageType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      priceMonthly,
      currency
    });
  emit('insurance.policy.created', { id: policy._id.toString(), housing, user: req.userId, provider }, { traceId: req.id });
    res.status(201).json({ policy });
  } catch (e) { next(e); }
};

exports.listPolicies = async (req,res,next) => {
  try {
    const { status, housing } = req.query;
    const filter = { user: req.userId };
    if (status) filter.status = status;
    if (housing) filter.housing = housing;
    const policies = await InsurancePolicy.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ policies });
  } catch (e) { next(e); }
};

exports.getPolicy = async (req,res,next) => {
  try {
    const { id } = req.params;
    const policy = await InsurancePolicy.findById(id);
    if (!policy || String(policy.user) !== String(req.userId)) throw new NotFoundError('Police introuvable');
  res.json({ policy });
  } catch (e) { next(e); }
};

exports.cancelPolicy = async (req,res,next) => {
  try {
    const { id } = req.params;
    const policy = await InsurancePolicy.findById(id);
    if (!policy || String(policy.user) !== String(req.userId)) throw new NotFoundError('Police introuvable');
    if (!['pending','active'].includes(policy.status)) throw new BadRequestError('Statut non annulable');
    policy.status = 'canceled';
    policy.canceledAt = new Date();
    await policy.save();
  res.json({ policy });
  } catch (e) { next(e); }
};
