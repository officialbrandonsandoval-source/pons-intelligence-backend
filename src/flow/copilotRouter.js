const express = require('express');

const { analyzeRevenue } = require('../intelligence/insightEngine');
const { getToken, isTokenExpired, getGhlCredentials } = require('../services/tokenStore');

const router = express.Router();

const isCrmConnected = ({ userId = 'dev' } = {}) => {
	const token = getToken(userId);
	const hubspotConnected = !!token && !isTokenExpired(token);
	const ghlConnected = !!getGhlCredentials(userId);
	return hubspotConnected || ghlConnected;
};

const buildMockDeals = ({ nowIso }) => {
	// Deterministic mocked deal set for demo mode when no CRM is connected.
	// Keep timestamps stable via provided now.
	const baseNow = typeof nowIso === 'string' ? nowIso : '2025-12-21T00:00:00.000Z';
	return [
		{
			id: 'mock-1',
			name: 'Acme Logistics',
			amount: 50000,
			stage: 'proposal',
			probability: 0.6,
			lastActivityAt: baseNow,
			stageChangedAt: '2025-12-15T00:00:00.000Z',
			createdAt: '2025-11-01T00:00:00.000Z',
		},
		{
			id: 'mock-2',
			name: 'Globex Retail',
			amount: 120000,
			stage: 'negotiation',
			probability: 0.75,
			lastActivityAt: baseNow,
			stageChangedAt: '2025-12-19T00:00:00.000Z',
			createdAt: '2025-10-10T00:00:00.000Z',
		},
		{
			id: 'mock-3',
			name: 'Initech',
			amount: 30000,
			stage: 'discovery',
			probability: 0.35,
			lastActivityAt: baseNow,
			stageChangedAt: '2025-12-02T00:00:00.000Z',
			createdAt: '2025-11-20T00:00:00.000Z',
		},
		{
			id: 'mock-4',
			name: 'Umbrella Health',
			amount: 80000,
			stage: 'proposal',
			probability: 0.5,
			lastActivityAt: baseNow,
			stageChangedAt: '2025-12-10T00:00:00.000Z',
			createdAt: '2025-09-15T00:00:00.000Z',
		},
	];
};

// Demo contract:
// POST /api/copilot
// Body: { query: string, userId?: string, now?: ISOString }
// Responses:
// - 400 JSON { error: "query_required" } when query missing/blank
// - 200 JSON { answer: string, structured: object }
// Guarantees:
// - deterministic (no AI calls)
// - never returns HTML
//
// NOTE: This router is mounted at /api/copilot in src/index.js.
router.post('/', express.json(), (req, res) => {
	const { query, userId = 'dev', now } = req.body || {};
	const q = typeof query === 'string' ? query.trim() : '';
	if (!q) return res.status(400).json({ error: 'query_required' });

	// If no CRM is connected, fall back to mocked deals.
	// (When CRM connectors exist, this can be expanded to fetch real deals.)
	const deals = isCrmConnected({ userId }) ? [] : buildMockDeals({ nowIso: now });

	// Deterministic analysis only.
	// Note: If CRM is connected but we don't yet fetch real deals, analyzing [] is still safe/deterministic.
	return Promise.resolve(analyzeRevenue({ deals, now }))
		.then((structured) => {
			const answer = typeof structured?.voiceSummary === 'string' ? structured.voiceSummary : '';
			return res.status(200).json({ answer, structured });
		})
		.catch((err) => {
			return res.status(500).json({ error: err?.message || 'copilot_failed' });
		});
});

module.exports = router;
