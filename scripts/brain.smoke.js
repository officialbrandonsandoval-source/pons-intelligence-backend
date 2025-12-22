/*
  Minimal, no-deps deterministic smoke tests for the PONS Core Intelligence Brain.

  Run:
    node scripts/brain.smoke.js
*/

const assert = (cond, msg) => {
	if (!cond) throw new Error(msg);
};

const { analyzeRevenue } = require('../src/ai/insightEngine');
const { detectRevenueLeaks } = require('../src/ai/revenueLeakDetector');
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

	// Leak taxonomy + sorting sanity
	{
		const leakDeals = [
			{
				id: 'd-stalled',
				name: 'Stalled',
				amount: 20000,
				stage: 'Qualified',
				probability: 0.5,
				lastActivityAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
				stageChangedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: 'd-ghosted',
				name: 'Ghosted late stage',
				amount: 90000,
				stage: 'Negotiation',
				probability: 0.7,
				lastActivityAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString(),
				stageChangedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
			},
			{
				id: 'd-dead',
				name: 'Dead lead',
				amount: 5000,
				stage: 'Prospecting',
				probability: 0.1,
				// no lastActivityAt, no stageChangedAt, no stageHistory
			},
			{
				id: 'd-lowprob-high',
				name: 'Low prob, high value',
				amount: 120000,
				stage: 'Discovery',
				probability: 0.15,
				lastActivityAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
				stageChangedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
			},
		];

		const leaks = detectRevenueLeaks(leakDeals, now);
		assert(leaks.length >= 3, 'expected at least 3 leaks');
		const types = new Set(leaks.map((l) => l.type));
		assert(types.has('STALLED_DEAL'), 'should detect STALLED_DEAL');
		assert(types.has('GHOSTED'), 'should detect GHOSTED');
		assert(types.has('DEAD_LEAD'), 'should detect DEAD_LEAD');
		assert(types.has('LOW_PROB_HIGH_VALUE'), 'should detect LOW_PROB_HIGH_VALUE');

		// Sorting: severity desc then amount desc
		for (let i = 1; i < leaks.length; i++) {
			const prev = leaks[i - 1];
			const cur = leaks[i];
			const rank = (s) => (s === 'high' ? 3 : s === 'medium' ? 2 : 1);
			const prevRank = rank(prev.severity);
			const curRank = rank(cur.severity);
			assert(
				prevRank > curRank || (prevRank === curRank && prev.amountAtRisk >= cur.amountAtRisk),
				'leaks should be sorted by severity then amount'
			);
		}
	}
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
