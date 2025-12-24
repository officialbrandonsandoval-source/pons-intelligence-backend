const express = require('express');

const { authenticate } = require('../middleware/auth');
const { analyzeRevenue } = require('../intelligence/insightEngine');

const router = express.Router();

// POST /api/intelligence/analyze
// Auth: x-api-key
// Input: { deals: [], now?: ISOString }
// Output: analyzeRevenue() JSON output only
router.post('/intelligence/analyze', authenticate, async (req, res, next) => {
	try {
		const { deals, now } = req.body || {};
		if (!Array.isArray(deals)) {
			return res.status(400).json({ error: 'deals must be an array' });
		}
		const out = await analyzeRevenue({ deals, now });
		return res.status(200).json(out);
	} catch (err) {
		return next(err);
	}
});

module.exports = router;
