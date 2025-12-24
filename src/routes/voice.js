const express = require('express');
const { authenticate } = require('../middleware/auth');
const { analyzeRevenue } = require('../intelligence/insightEngine');

const router = express.Router();

const buildMockDeals = ({ nowIso }) => {
	const baseNow = typeof nowIso === 'string' ? nowIso : '2025-12-21T00:00:00.000Z';
	return [
		{
			id: 'voice-mock-1',
			name: 'Acme Logistics',
			amount: 50000,
			stage: 'proposal',
			probability: 0.6,
			lastActivityAt: baseNow,
			stageChangedAt: '2025-12-15T00:00:00.000Z',
			createdAt: '2025-11-01T00:00:00.000Z',
		},
		{
			id: 'voice-mock-2',
			name: 'Globex Retail',
			amount: 120000,
			stage: 'negotiation',
			probability: 0.75,
			lastActivityAt: baseNow,
			stageChangedAt: '2025-12-19T00:00:00.000Z',
			createdAt: '2025-10-10T00:00:00.000Z',
		},
		{
			id: 'voice-mock-3',
			name: 'Initech',
			amount: 30000,
			stage: 'discovery',
			probability: 0.35,
			lastActivityAt: baseNow,
			stageChangedAt: '2025-12-02T00:00:00.000Z',
			createdAt: '2025-11-20T00:00:00.000Z',
		},
		{
			id: 'voice-mock-4',
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
// POST /api/voice/session/start
// - validates x-api-key
// - returns 200 JSON { sessionId: "demo", ready: true }
router.post('/session/start', authenticate, (req, res) => {
	return res.status(200).json({ sessionId: 'demo', ready: true });
});

// Demo contract:
// POST /api/voice/command
// - validates x-api-key
// - accepts multipart/form-data OR JSON
// - ignores audio content
// - calls analyzeRevenue() using mocked deals
// - returns { transcript: "demo voice input", response: voiceSummary, audio: null }
router.post(
	'/command',
	authenticate,
	express.json(),
	express.urlencoded({ extended: false }),
	(req, res, next) => {
		// For multipart/form-data without multer, parse is skipped; that's fine because we ignore audio.
		return next();
	},
	(req, res) => {
		const now = req.body?.now;
		const deals = buildMockDeals({ nowIso: now });
		return Promise.resolve(analyzeRevenue({ deals, now }))
			.then((structured) => {
				const voiceSummary = typeof structured?.voiceSummary === 'string' ? structured.voiceSummary : '';
				return res.status(200).json({
					transcript: 'demo voice input',
					response: voiceSummary,
					audio: null,
				});
			})
			.catch((err) => {
				return res.status(500).json({ error: err?.message || 'voice_command_failed' });
			});
	}
);

module.exports = router;
