const express = require('express');

const { authenticate } = require('../middleware/auth');
const { analyzeRevenue } = require('../ai/insightEngine');
const { logError } = require('../utils/logger');
const { validateCRMData } = require('../utils/validate');

const { getDeals } = require('../services/hubspot/deals');
const { getToken, isTokenExpired, getGhlCredentials } = require('../services/tokenStore');

const { buildCopilotMetrics } = require('../services/copilot/metrics');

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

router.post('/copilot', authenticate, async (req, res) => {
	try {
		const { source, userId = 'dev', query, mode = 'hybrid', data } = req.body || {};

		const resolvedSource = source;
		const resolvedMode = mode;
		if (!resolvedSource) return res.status(400).json({ error: 'source is required' });
		if (!['hubspot', 'gohighlevel'].includes(resolvedSource)) {
			return res.status(400).json({ error: 'source must be "hubspot" or "gohighlevel"' });
		}
		if (!['silent', 'hybrid', 'voice'].includes(resolvedMode)) {
			return res.status(400).json({ error: 'mode must be "silent", "hybrid", or "voice"' });
		}

		const crmData = await fetchCrmData({ source: resolvedSource, userId, data });
		validateCRMData(crmData);

		const insight = await analyzeRevenue(crmData);
		const metrics = buildCopilotMetrics({ crmData, insight });

		const greeting = buildGreeting({ userId, source: resolvedSource });
		const answer = query && String(query).trim() ? String(query).trim() : '';

		// We are deliberately *not* using the LLM for reasoning here.
		// If a query is provided, we return a concise, deterministic response using the new 3-metric model.
		let answerText = '';
		if (answer) {
			answerText = `${metrics.nextBestAction.text} Impact: ${metrics.nextBestAction.impact}. Cash at risk: $${metrics.cashAtRisk.amount} across ${metrics.cashAtRisk.count} deals. Velocity: ${metrics.revenueVelocity.label} (${metrics.revenueVelocity.wowPercent}% WoW).`;
		}

		return res.json({
			greeting,
			metrics,
			answer: answerText,
			suggestedQuestions: suggestQuestions({ insight }),
			rawInsight: insight,
			// mode is accepted for the client experience, but the API response remains stable.
			mode: resolvedMode,
		});
	} catch (err) {
		logError(err, { endpoint: '/copilot' });
		return res.status(400).json({ error: err.message || 'Copilot request failed' });
	}
});

module.exports = router;
