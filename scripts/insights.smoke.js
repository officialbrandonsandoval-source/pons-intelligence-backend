/* eslint-disable no-console */

// No-deps smoke test for POST /api/insights.
// Purpose: lock the deterministic contract of the analyzeRevenue engine via the HTTP endpoint.
//
// Run:
//   node scripts/insights.smoke.js

const assert = (cond, msg) => {
	if (!cond) throw new Error(`ASSERT: ${msg}`);
};

const requestJson = async ({ app, method, path, body }) => {
	const server = app.listen(0);
	try {
		const { port } = server.address();
		const res = await fetch(`http://127.0.0.1:${port}${path}`, {
			method,
			headers: {
				'content-type': 'application/json',
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		const json = await res.json().catch(() => ({}));
		return { status: res.status, json };
	} finally {
		server.close();
	}
};

(async () => {
	const app = require('../src/index');

	// 1) Validation: missing deals array => 400
	{
		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/insights',
			body: { deals: 'nope' },
		});
		assert(status === 400, 'expected 400 when deals is not an array');
		assert(json?.error === 'deals must be an array', 'expected deals must be an array error');
	}

	// 2) Happy path: deterministic output keys exist
	{
		const deals = [
			{
				id: 'd-1',
				name: 'Acme',
				amount: 50000,
				stage: 'proposal',
				probability: 0.6,
				lastActivityAt: '2025-12-01T00:00:00.000Z',
				stageChangedAt: '2025-11-20T00:00:00.000Z',
				createdAt: '2025-10-01T00:00:00.000Z',
			},
			{
				id: 'd-2',
				name: 'Globex',
				amount: 120000,
				stage: 'negotiation',
				probability: 0.75,
				lastActivityAt: '2025-12-20T00:00:00.000Z',
				stageChangedAt: '2025-12-19T00:00:00.000Z',
				createdAt: '2025-09-01T00:00:00.000Z',
			},
		];

		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/insights',
			body: { deals, now: '2025-12-21T00:00:00.000Z' },
		});

		assert(status === 200, 'expected 200 for valid insights call');
		assert(json && typeof json === 'object', 'expected JSON object response');

		// Contract keys from analyzeRevenue
		assert(!!json.cashAtRisk, 'expected cashAtRisk');
		assert(typeof json.cashAtRisk.amount === 'number', 'expected cashAtRisk.amount number');
		assert(typeof json.cashAtRisk.count === 'number', 'expected cashAtRisk.count number');

		assert(!!json.velocity, 'expected velocity');
		assert(typeof json.velocity.status === 'string', 'expected velocity.status string');

		assert(!!json.nextBestAction, 'expected nextBestAction');
		assert(typeof json.nextBestAction.action === 'string', 'expected nextBestAction.action string');

		assert(Array.isArray(json.prioritizedDeals), 'expected prioritizedDeals array');
		assert(Array.isArray(json.revenueLeaks), 'expected revenueLeaks array');
		assert(typeof json.voiceSummary === 'string', 'expected voiceSummary string');
	}

	console.log('insights.smoke: PASS');
})().catch((err) => {
	console.error('insights.smoke: FAIL');
	console.error(err);
	process.exit(1);
});
