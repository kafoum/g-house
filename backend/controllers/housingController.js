const cloudinary = require('cloudinary').v2;
const Housing = require('../models/Housing');
const Booking = require('../models/Booking');
const Conversation = require('../models/Conversation');
const { BadRequestError, ForbiddenError, NotFoundError } = require('../middleware/errorHandler');

async function createHousing(req, res, next) {
  if (req.role !== 'landlord') return next(new ForbiddenError('Accès refusé. Propriétaire requis.'));
  try {
  const { title, description, price, address, city, zipCode, type, amenities, lat, lon, aplEligible, furnished } = req.body;
    if (!title || !description || !price || !address || !city || !zipCode || !type) {
      throw new BadRequestError('Tous les champs requis ne sont pas remplis.');
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) throw new BadRequestError('Prix invalide.');
    const amenityList = amenities ? amenities.split(',').map(a => a.trim()).filter(Boolean) : [];
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        const result = await cloudinary.uploader.upload(dataURI, { folder: `g-house/housing_${req.userId}` });
        imageUrls.push(result.secure_url);
      }
    }
    const newHousing = new Housing({
      title,
      description,
      price: priceNum,
      location: { address, city, zipCode },
      type,
      amenities: amenityList,
      landlord: req.userId,
      images: imageUrls,
      aplEligible: aplEligible !== undefined ? (aplEligible === 'true' || aplEligible === true) : undefined,
      furnished: furnished !== undefined ? (furnished === 'true' || furnished === true) : undefined,
    });
    if (lat && lon) {
      const latNum = parseFloat(lat); const lonNum = parseFloat(lon);
      if (!isNaN(latNum) && !isNaN(lonNum)) newHousing.locationPoint = { type: 'Point', coordinates: [ lonNum, latNum ] };
    }
    await newHousing.save();
    res.status(201).json({ message: 'Logement créé avec succès.', housing: newHousing });
  } catch (e) { next(e); }
}

async function updateHousing(req, res, next) {
  if (req.role !== 'landlord') return next(new ForbiddenError('Accès refusé. Propriétaire requis.'));
  try {
    const housing = await Housing.findById(req.params.id);
    if (!housing) throw new NotFoundError('Logement non trouvé.');
    if (housing.landlord.toString() !== req.userId) throw new ForbiddenError('Pas propriétaire de cette annonce.');
  const { title, description, price, address, city, zipCode, type, amenities, lat, lon, aplEligible, furnished } = req.body;
    if (title) housing.title = title;
    if (description) housing.description = description;
    if (price) housing.price = parseFloat(price) || housing.price;
    if (address) housing.location.address = address;
    if (city) housing.location.city = city;
    if (zipCode) housing.location.zipCode = zipCode;
    if (type) housing.type = type;
    if (amenities) housing.amenities = amenities.split(',').map(a => a.trim()).filter(Boolean);
  if (aplEligible !== undefined) housing.aplEligible = (aplEligible === 'true' || aplEligible === true);
  if (furnished !== undefined) housing.furnished = (furnished === 'true' || furnished === true);
  if (lat && lon) {
      const latNum = parseFloat(lat); const lonNum = parseFloat(lon);
      if (!isNaN(latNum) && !isNaN(lonNum)) housing.locationPoint = { type: 'Point', coordinates: [ lonNum, latNum ] };
    }
    if (req.files && req.files.length > 0) {
      const newImageUrls = [];
      for (const file of req.files) {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        const result = await cloudinary.uploader.upload(dataURI, { folder: `g-house/housing_${req.userId}` });
        newImageUrls.push(result.secure_url);
      }
      housing.images = newImageUrls;
    }
    await housing.save();
    res.json({ message: 'Logement mis à jour avec succès.', housing });
  } catch (e) { next(e); }
}

async function deleteHousing(req, res, next) {
  if (req.role !== 'landlord') return next(new ForbiddenError('Accès refusé. Propriétaire requis.'));
  try {
    const housingId = req.params.id;
    const result = await Housing.findOneAndDelete({ _id: housingId, landlord: req.userId });
    if (!result) throw new NotFoundError('Logement non trouvé ou non propriétaire.');
    await Booking.deleteMany({ housing: housingId });
    await Conversation.deleteMany({ housing: housingId });
    res.json({ message: 'Logement supprimé avec succès.' });
  } catch (e) { next(e); }
}

async function listHousing(req, res, next) {
  try {
    const { city, price_min, price_max, type, page = 1, limit = 10, aplEligible, furnished } = req.query;
    const filters = { status: 'active' };
    if (city) filters['location.city'] = { $regex: city, $options: 'i' };
    if (type) filters.type = type;
    if (aplEligible !== undefined) filters.aplEligible = aplEligible === 'true' || aplEligible === true || aplEligible === '1';
    if (furnished !== undefined) filters.furnished = furnished === 'true' || furnished === true || furnished === '1';
    if (price_min || price_max) {
      filters.price = {};
      if (price_min) filters.price.$gte = parseFloat(price_min);
      if (price_max) filters.price.$lte = parseFloat(price_max);
    }
    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10), 1), 50);
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
      Housing.find(filters).populate('landlord', 'name').skip(skip).limit(limitNum).sort({ createdAt: -1 }),
      Housing.countDocuments(filters)
    ]);
    const totalPages = Math.ceil(total / limitNum) || 1;
    res.json({
      data: items,
      meta: { page: pageNum, limit: limitNum, total, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 }
    });
  } catch (e) { next(e); }
}

async function getHousing(req, res, next) {
  try {
    const housing = await Housing.findById(req.params.id).populate('landlord', '_id name email role');
    if (!housing) throw new NotFoundError('Logement non trouvé.');
    housing.views = (housing.views || 0) + 1;
    await housing.save();
    res.json({ housing });
  } catch (e) { next(e); }
}

async function listUserHousing(req, res, next) {
  if (req.role !== 'landlord') return next(new ForbiddenError('Accès refusé. Propriétaire requis.'));
  try {
    const housing = await Housing.find({ landlord: req.userId });
    res.json({ housing });
  } catch (e) { next(e); }
}

module.exports = { createHousing, updateHousing, deleteHousing, listHousing, getHousing, listUserHousing };
