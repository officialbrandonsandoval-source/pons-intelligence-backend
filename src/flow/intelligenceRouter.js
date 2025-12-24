const express = require('express');

const { authenticate } = require('../middleware/auth');
const { analyzeRevenue } = require('../ai/insightEngine');
const { logError } = require('../utils/logger');
const { validateCRMData } = require('../utils/validate');

const { getDeals } = require('../services/hubspot/deals');
const { getToken, isTokenExpired, getGhlCredentials } = require('../services/tokenStore');

const router = express.Router();

const emptyIntelligence = async ({ now = new Date() } = {}) => {
	// Keep the contract identical to the brain output, but empty.
	return analyzeRevenue({ deals: [], now });
};

const fetchCrmData = async ({ source, userId = 'dev', data }) => {
	// If the caller provided data explicitly (for testing), trust it.
	if (data) return data;

	if (source === 'hubspot') {
		const token = getToken(userId);
		if (!token) {
			const err = new Error('HubSpot is not authorized. Start at /api/auth/hubspot');
			err.status = 400;
			throw err;
		}
		if (isTokenExpired(token)) {
			const err = new Error('HubSpot token expired. Reconnect via /api/auth/hubspot');
			err.status = 401;
			throw err;
		}
		return getDeals(token);
	}

	if (source === 'gohighlevel') {
		const creds = getGhlCredentials(userId);
		if (!creds) {
			const err = new Error('gohighlevel_not_connected');
			err.status = 409;
			throw err;
		}

		// This backend intentionally stores GHL credentials but does not yet implement
		// a deals fetcher. When added, wire it here.
		const err = new Error('GoHighLevel deal fetch is not implemented yet in this backend');
		err.status = 400;
		throw err;
	}

	const err = new Error('source must be "hubspot" or "gohighlevel"');
	err.status = 400;
	throw err;
};

const normalizeDeals = (crmData, source) => {
	// Back-compat bridge:
	// connectors currently return { leads: [...] }. The brain expects normalized Deal[].
	const leads = Array.isArray(crmData?.leads) ? crmData.leads : [];
	return leads.map((l) => ({
		id: l.id || l.dealId || l.leadId || l.name,
		name: l.name,
		amount: l.amount,
		stage: l.stage,
		probability: l.probability,
		lastActivityAt: l.lastActivityAt || l.lastContact || l.closeDate || l.closedate,
		createdAt: l.createdAt,
		expectedCloseDate: l.expectedCloseDate || l.closeDate || l.closedate,
		owner: l.owner,
		source,
	}));
};

// POST /api/intelligence/analyze
// Input: { source: "hubspot" | "gohighlevel", userId }
router.post('/intelligence/analyze', authenticate, async (req, res) => {
	try {
		const { source, userId = 'dev', data } = req.body || {};

		if (!source) return res.status(400).json({ error: 'source is required' });
		if (!['hubspot', 'gohighlevel'].includes(source)) {
			return res.status(400).json({ error: 'source must be "hubspot" or "gohighlevel"' });
		}
		if (!userId || typeof userId !== 'string' || !userId.trim()) {
			return res.status(400).json({ error: 'userId is required' });
		}

		let crmData;
		try {
			crmData = await fetchCrmData({ source, userId: userId.trim(), data });
		} catch (err) {
			// No CRM connected should be a 400.
			const status = err.status || 400;
			return res.status(status).json({ error: err.message });
		}

		// We want "no deals" to return empty intelligence (not error),
		// but validateCRMData currently requires a non-empty leads array.
		// So we validate minimally here, then only apply validateCRMData when leads exist.
		if (!crmData || typeof crmData !== 'object' || Array.isArray(crmData)) {
			return res.status(400).json({ error: 'CRM data must be an object' });
		}

		const leads = Array.isArray(crmData.leads) ? crmData.leads : null;
		if (!leads) {
			return res.status(400).json({ error: 'CRM data must include a leads array' });
		}

		if (leads.length > 0) {
			try {
				validateCRMData(crmData);
			} catch (err) {
				return res.status(400).json({ error: err.message || 'Invalid CRM data' });
			}
		}

		const deals = normalizeDeals(crmData, source);

		if (!deals.length) {
			const insight = await emptyIntelligence({ now: new Date() });
			return res.json({ insight });
		}

		const insight = await analyzeRevenue({ deals, now: new Date() });
		return res.json({ insight });
	} catch (err) {
		logError(err, { endpoint: '/intelligence/analyze' });
		return res.status(500).json({ error: err.message || 'Intelligence analyze failed' });
	}
});

module.exports = router;
