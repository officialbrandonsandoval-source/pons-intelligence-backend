const express = require('express');

const { authenticate } = require('../middleware/auth');
const { analyzeRevenue } = require('../ai/insightEngine');
const { logError } = require('../utils/logger');
const { validateCRMData } = require('../utils/validate');

const { getDeals } = require('../services/hubspot/deals');
const { getToken, isTokenExpired, getGhlCredentials } = require('../services/tokenStore');

const router = express.Router();

const buildGreeting = ({ userId, source }) => {
	const name = userId && userId !== 'dev' ? userId : 'there';
	const src = source === 'hubspot' ? 'HubSpot' : 'GoHighLevel';
	return `Hey ${name} — I’ve got your ${src} pipeline.`;
};

const suggestQuestions = ({ insight }) => {
	const topAction = (insight?.topAction || '').trim();
	return [
		'Which deals are most at risk right now?',
		topAction ? `How do I execute: “${topAction}”?` : 'What’s the single next best action?',
		'What should I do today to increase close probability?',
	];
};

const fetchCrmData = async ({ source, userId = 'dev', data }) => {
	// If the caller provided data explicitly, trust it.
	if (data) return data;

	if (source === 'hubspot') {
		const token = getToken(userId);
		if (!token) {
			throw new Error('HubSpot is not authorized. Start at /api/auth/hubspot');
		}
		if (isTokenExpired(token)) {
			throw new Error('HubSpot token expired. Reconnect via /api/auth/hubspot');
		}
		return getDeals(token);
	}

	if (source === 'gohighlevel') {
		// NOTE: We intentionally do not add any new deps or APIs here.
		// This backend currently stores GHL credentials (apiKey + locationId) but does not yet
		// implement a real GHL deals fetcher. When that fetcher is added, wire it here.
		const creds = getGhlCredentials(userId);
		if (!creds) {
			throw new Error('GoHighLevel is not connected. First POST /api/auth/ghl');
		}

		throw new Error('GoHighLevel deal fetch is not implemented yet in this backend');
	}

	throw new Error('source must be "hubspot" or "gohighlevel"');
};

// Production-simple copilot endpoint.
// Contract:
// - Body: { query: string, source?: string, userId?: string }
// - 400 if query missing
// - 200 { response: string }
router.post('/copilot', authenticate, async (req, res) => {
	try {
		const { query } = req.body || {};
		const q = typeof query === 'string' ? query.trim() : '';
		if (!q) return res.status(400).json({ error: 'query is required' });
		return res.json({ response: `Received: ${q}` });
	} catch (err) {
		logError(err, { endpoint: '/copilot' });
		return res.status(500).json({ error: err.message || 'Internal Server Error' });
	}
});

module.exports = router;
