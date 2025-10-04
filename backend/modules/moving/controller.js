const MoveRequest = require('./MoveRequest');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../../middleware/errorHandler');
const { emit } = require('../../events/bus');

exports.createMove = async (req,res,next) => {
  try {
    const { fromAddress, toAddress, housingFrom, housingTo, volumeM3, desiredDate, notes } = req.body;
    if (!fromAddress && !housingFrom) throw new BadRequestError('Origine requise (fromAddress ou housingFrom)');
    if (!toAddress && !housingTo) throw new BadRequestError('Destination requise (toAddress ou housingTo)');
    const priceEstimate = volumeM3 ? Math.round(volumeM3 * 25) : 100; // simple heuristique
    const move = await MoveRequest.create({
      user: req.userId,
      fromAddress,
      toAddress,
      housingFrom,
      housingTo,
      volumeM3,
      desiredDate: new Date(desiredDate),
      notes,
      priceEstimate
    });
  emit('moving.request.created', { id: move._id.toString(), user: req.userId, priceEstimate }, { traceId: req.id });
    res.status(201).json({ move });
  } catch (e) { next(e); }
};

exports.listMoves = async (req,res,next) => {
  try {
    const { status } = req.query;
    const filter = { user: req.userId };
    if (status) filter.status = status;
    const moves = await MoveRequest.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json({ moves });
  } catch (e) { next(e); }
};

exports.getMove = async (req,res,next) => {
  try {
    const { id } = req.params;
    const move = await MoveRequest.findById(id);
    if (!move || String(move.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    res.json({ move });
  } catch (e) { next(e); }
};

exports.scheduleMove = async (req,res,next) => {
  try {
    const { id } = req.params;
    const { scheduledDate } = req.body;
    const move = await MoveRequest.findById(id);
    if (!move || String(move.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    if (move.status !== 'requested') throw new BadRequestError('Statut invalide pour planification');
    move.status = 'scheduled';
    move.scheduledDate = new Date(scheduledDate);
    await move.save();
  emit('moving.request.scheduled', { id: move._id.toString(), scheduledDate: move.scheduledDate }, { traceId: req.id });
    res.json({ move });
  } catch (e) { next(e); }
};

exports.startMove = async (req,res,next) => {
  try {
    const { id } = req.params;
    const move = await MoveRequest.findById(id);
    if (!move || String(move.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    if (move.status !== 'scheduled') throw new BadRequestError('Statut invalide pour démarrer');
    move.status = 'in_progress';
    await move.save();
  emit('moving.request.started', { id: move._id.toString() }, { traceId: req.id });
    res.json({ move });
  } catch (e) { next(e); }
};

exports.completeMove = async (req,res,next) => {
  try {
    const { id } = req.params;
    const move = await MoveRequest.findById(id);
    if (!move || String(move.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    if (move.status !== 'in_progress') throw new BadRequestError('Statut invalide pour compléter');
    move.status = 'completed';
    await move.save();
  emit('moving.request.completed', { id: move._id.toString() }, { traceId: req.id });
    res.json({ move });
  } catch (e) { next(e); }
};

exports.cancelMove = async (req,res,next) => {
  try {
    const { id } = req.params;
    const move = await MoveRequest.findById(id);
    if (!move || String(move.user) !== String(req.userId)) throw new NotFoundError('Demande introuvable');
    if (!['requested','scheduled'].includes(move.status)) throw new BadRequestError('Statut non annulable');
    move.status = 'canceled';
    await move.save();
  emit('moving.request.canceled', { id: move._id.toString() }, { traceId: req.id });
    res.json({ move });
  } catch (e) { next(e); }
};
