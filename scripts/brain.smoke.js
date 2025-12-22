/*
  Minimal, no-deps deterministic smoke tests for the PONS Core Intelligence Brain.

  Run:
    node scripts/brain.smoke.js
*/

const assert = (cond, msg) => {
	if (!cond) throw new Error(msg);
};

const { analyzeRevenue } = require('../src/ai/insightEngine');
const { rankDeals } = require('../src/ai/dealPrioritization');

const run = async () => {
	const now = new Date('2025-12-21T00:00:00Z');

	const deals = [
		{
			id: 'd-late-recent',
			name: 'Late + Recent',
			amount: 120000,
			stage: 'negotiation',
			probability: 0.75,
			lastActivityAt: '2025-12-20T00:00:00Z',
			stageChangedAt: '2025-12-19T00:00:00Z',
			createdAt: '2025-10-01T00:00:00Z',
		},
		{
			id: 'd-old',
			name: 'Old + Stale',
			amount: 200000,
			stage: 'proposal',
			probability: 0.6,
			lastActivityAt: '2025-10-01T00:00:00Z',
			stageChangedAt: '2025-10-01T00:00:00Z',
			createdAt: '2025-08-01T00:00:00Z',
		},
		{
			id: 'd-missing-prob',
			name: 'Missing Probability',
			amount: 50000,
			stage: 'proposal',
			lastActivityAt: '2025-12-18T00:00:00Z',
			stageChangedAt: '2025-12-10T00:00:00Z',
			createdAt: '2025-09-01T00:00:00Z',
		},
	];

	const ranked = rankDeals(deals, now);
	assert(Array.isArray(ranked) && ranked.length === 3, 'rankDeals should return 3 items');
	assert(ranked[0].dealId === 'd-late-recent', 'late+recent should outrank old stale even if old has bigger amount');
	assert(['high', 'medium', 'low'].includes(ranked[0].priority), 'priority should be one of high/medium/low');
	assert(typeof ranked[0].recommendedAction === 'string', 'recommendedAction should be a string');

	const brain = await analyzeRevenue({ deals, now });
	assert(brain && typeof brain === 'object', 'analyzeRevenue should return an object');
	assert(brain.cashAtRisk && typeof brain.cashAtRisk.amount === 'number', 'cashAtRisk.amount should be number');
	assert(brain.velocity && typeof brain.velocity.status === 'string', 'velocity.status should exist');
	assert(brain.nextBestAction && typeof brain.nextBestAction.action === 'string', 'nextBestAction.action should exist');
	assert(Array.isArray(brain.prioritizedDeals), 'prioritizedDeals should be an array');
	assert(Array.isArray(brain.revenueLeaks), 'revenueLeaks should be an array');
	assert(typeof brain.voiceSummary === 'string' && brain.voiceSummary.length > 10, 'voiceSummary should be a string');

	// cashAtRisk rule: stalled > 14 days
	// d-old lastActivity 2025-10-01 is > 14 days stale; should be included.
	assert(brain.cashAtRisk.deals.includes('d-old'), 'cashAtRisk should include stale deals > 14 days');

	process.stdout.write('brain.smoke: PASS\n');
};

run().catch((err) => {
	process.stderr.write(`brain.smoke: FAIL: ${err.message}\n`);
	process.exit(1);
});
