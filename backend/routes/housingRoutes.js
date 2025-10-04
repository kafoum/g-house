const express = require('express');
const auth = require('../middleware/auth');
const multer = require('multer');
const { createHousing, updateHousing, deleteHousing, listHousing, getHousing, listUserHousing } = require('../controllers/housingController');
const { validate } = require('../validation/validate');
const { housingCreateSchema, housingUpdateSchema, housingListQuery } = require('../validation/schemas');

const Housing = require('../models/Housing');
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/', validate({ query: housingListQuery }), listHousing);
// Recherche par rayon: /api/housing/search/radius?lat=..&lon=..&radiusKm=5
router.get('/search/radius', auth, async (req,res,next) => {
	try {
		const { lat, lon, radiusKm = 5, maxPrice, type, aplEligible, furnished } = req.query;
		if (!lat || !lon) return res.status(400).json({ message: 'lat et lon requis' });
		const radiusMeters = Number(radiusKm) * 1000;
		const filter = { status: 'active' };
		if (maxPrice) filter.price = { $lte: Number(maxPrice) };
		if (type) filter.type = type;
		if (aplEligible !== undefined) filter.aplEligible = aplEligible === 'true' || aplEligible === '1';
		if (furnished !== undefined) filter.furnished = furnished === 'true' || furnished === '1';
		filter.locationPoint = {
			$near: {
				$geometry: { type: 'Point', coordinates: [ Number(lon), Number(lat) ] },
				$maxDistance: radiusMeters
			}
		};
		const results = await Housing.find(filter).limit(50).select('title price locationPoint type location');
		res.json({ data: results, meta: { count: results.length } });
	} catch (e) { next(e); }
});

// Insights / classification
router.get('/insights/stats', auth, async (req,res,next) => {
	try {
		const since = new Date(Date.now() - 1000*60*60*24*30); // 30 jours
		const pipeline = [
			{ $match: { status: 'active', createdAt: { $gte: since } } },
			{ $project: { title: 1, price:1, views:1, createdAt:1 } },
		];
		const housings = await Housing.aggregate(pipeline);
		// Popular: top 10% vues
		const viewsSorted = [...housings].sort((a,b) => (b.views||0)-(a.views||0));
		const cut = Math.max(1, Math.floor(viewsSorted.length * 0.1));
		const popularIds = new Set(viewsSorted.slice(0, cut).map(h=> String(h._id)));
		// High demand: vues > 20 ET créé depuis <14 jours
		const highDemandIds = new Set(housings.filter(h => (h.views||0) > 20 && (Date.now()-h.createdAt.getTime()) < 14*24*3600*1000).map(h=> String(h._id)));
		// Rare (perle): prix < médiane - 20% ET vues croissantes (<5) => peut être opportunité
		const prices = housings.map(h=> h.price).sort((a,b)=>a-b);
		const median = prices.length ? prices[Math.floor(prices.length/2)] : 0;
		const rareIds = new Set(housings.filter(h => h.price < median * 0.8 && (h.views||0) < 5).map(h=> String(h._id)));
		const annotated = housings.map(h => ({
			id: h._id,
			title: h.title,
			price: h.price,
			views: h.views||0,
			tags: [
				popularIds.has(String(h._id)) ? 'popular': null,
				highDemandIds.has(String(h._id)) ? 'high_demand': null,
				rareIds.has(String(h._id)) ? 'rare': null
			].filter(Boolean)
		}));
		res.json({ count: annotated.length, data: annotated, meta: { medianPrice: median } });
	} catch (e) { next(e); }
});
router.get('/:id', getHousing);
router.get('/user/me', auth, listUserHousing); // ex: /api/housing/user/me
router.post('/', auth, upload.array('images', 5), validate({ body: housingCreateSchema }), createHousing);
router.put('/:id', auth, upload.array('images', 5), validate({ body: housingUpdateSchema }), updateHousing);
router.delete('/:id', auth, deleteHousing);

module.exports = router;
