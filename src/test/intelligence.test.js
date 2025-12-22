/* eslint-disable no-console */

// Local intelligence engine test (run via node)
// Purpose: validate deterministic brain outputs against a realistic mocked pipeline.

const assert = (cond, msg) => {
	if (!cond) throw new Error(`ASSERT: ${msg}`);
};

const { analyzeRevenue } = require('../ai/insightEngine');

const daysAgo = (now, days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

(async () => {
	const now = new Date('2025-12-21T12:00:00.000Z');

	// 10 deals: mixed stages, mixed activity, at least 2 stalled high-value deals
	const deals = [
		{
			id: 'd-100',
			name: 'Acme Annual',
			amount: 150000,
			stage: 'Qualified',
			probability: 0.55,
			lastActivityAt: daysAgo(now, 22), // stalled
			stageChangedAt: daysAgo(now, 25),
			createdAt: daysAgo(now, 60),
		},
		{
			id: 'd-101',
			name: 'Zenith Expansion',
			amount: 90000,
			stage: 'Negotiation',
			probability: 0.75,
			lastActivityAt: daysAgo(now, 18), // stalled + late stage
			stageChangedAt: daysAgo(now, 7),
			createdAt: daysAgo(now, 45),
		},
		{
			id: 'd-102',
			name: 'Boulder Pilot',
			amount: 18000,
			stage: 'Discovery',
			probability: 0.35,
			lastActivityAt: daysAgo(now, 2),
			stageChangedAt: daysAgo(now, 3),
			createdAt: daysAgo(now, 14),
		},
		{
			id: 'd-103',
			name: 'Northwind Onboarding',
			amount: 32000,
			stage: 'Proposal',
			probability: 0.6,
			lastActivityAt: daysAgo(now, 6),
			stageChangedAt: daysAgo(now, 6),
			createdAt: daysAgo(now, 20),
		},
		{
			id: 'd-104',
			name: 'Contoso Renewal',
			amount: 65000,
			stage: 'Contract',
			probability: 0.85,
			lastActivityAt: daysAgo(now, 11),
			stageChangedAt: daysAgo(now, 4),
			createdAt: daysAgo(now, 30),
		},
		{
			id: 'd-105',
			name: 'Fabrikam New Logo',
			amount: 12000,
			stage: 'Prospecting',
			probability: 0.15,
			lastActivityAt: daysAgo(now, 1),
			stageChangedAt: daysAgo(now, 12),
			createdAt: daysAgo(now, 12),
		},
		{
			id: 'd-106',
			name: 'Globex Enterprise',
			amount: 220000,
			stage: 'Discovery',
			probability: 0.12, // low prob, high value (leak)
			lastActivityAt: daysAgo(now, 4),
			stageChangedAt: daysAgo(now, 4),
			createdAt: daysAgo(now, 35),
		},
		{
			id: 'd-107',
			name: 'Initech Upsell',
			amount: 24000,
			stage: 'Qualified',
			probability: 0.52,
			lastActivityAt: daysAgo(now, 0),
			stageChangedAt: daysAgo(now, 1),
			createdAt: daysAgo(now, 10),
		},
		{
			id: 'd-108',
			name: 'Hooli Trial',
			amount: 8000,
			stage: 'Prospecting',
			probability: 0.1,
			// dead lead pattern: no activity, no movement
		},
		{
			id: 'd-109',
			name: 'Vandelay Procurement',
			amount: 41000,
			stage: 'Qualified',
			probability: 0.5,
			lastActivityAt: daysAgo(now, 9),
			stageChangedAt: daysAgo(now, 15),
			createdAt: daysAgo(now, 80),
		},
	];

	const intelligence = await analyzeRevenue({ deals, now });

	assert(intelligence && typeof intelligence === 'object', 'intelligence should be an object');
	assert(intelligence.cashAtRisk && typeof intelligence.cashAtRisk === 'object', 'cashAtRisk exists');
	assert(Number(intelligence.cashAtRisk.amount) > 0, 'cashAtRisk.amount > 0');
	assert(intelligence.nextBestAction && typeof intelligence.nextBestAction === 'object', 'nextBestAction exists');
	assert(!!intelligence.nextBestAction.action, 'nextBestAction.action exists');
	assert(Array.isArray(intelligence.revenueLeaks), 'revenueLeaks should be an array');
	assert(intelligence.revenueLeaks.length >= 1, 'revenueLeaks.length >= 1');
	assert(typeof intelligence.voiceSummary === 'string', 'voiceSummary should be a string');
	assert(intelligence.voiceSummary.length < 400, 'voiceSummary should be < 400 chars');

	console.log('intelligence.test: PASS');
	console.log({
		cashAtRisk: intelligence.cashAtRisk,
		nextBestAction: intelligence.nextBestAction,
		velocity: intelligence.velocity,
		revenueLeaksTop: intelligence.revenueLeaks.slice(0, 2),
		voiceSummary: intelligence.voiceSummary,
	});
})().catch((err) => {
	console.error('intelligence.test: FAIL');
	console.error(err);
	process.exit(1);
});
