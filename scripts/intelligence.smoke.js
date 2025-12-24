/* eslint-disable no-console */

// No-deps smoke test for POST /api/intelligence/analyze.
// Contract:
// - Protected by x-api-key
// - Accepts JSON { deals: [], now?: ISOString }
// - 400 if deals is not an array
// - 200 on success
// - Returns ONLY analyzeRevenue() output JSON

const assert = (cond, msg) => {
	if (!cond) throw new Error(`ASSERT: ${msg}`);
};

const requestJson = async ({ app, method, path, body, headers }) => {
	const server = app.listen(0);
	try {
		const { port } = server.address();
		const res = await fetch(`http://127.0.0.1:${port}${path}`, {
			method,
			headers: {
				'content-type': 'application/json',
				...(headers || {}),
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

	process.env.API_KEY = process.env.API_KEY || 'test_api_key';

	// 1) Missing key -> 401
	{
		const { status } = await requestJson({
			app,
			method: 'POST',
			path: '/api/intelligence/analyze',
			body: { deals: [] },
		});
		assert(status === 401, `expected 401 without x-api-key, got ${status}`);
	}

	// 2) Wrong key -> 403
	{
		const { status } = await requestJson({
			app,
			method: 'POST',
			path: '/api/intelligence/analyze',
			body: { deals: [] },
			headers: { 'x-api-key': 'wrong_key' },
		});
		assert(status === 403, `expected 403 with wrong x-api-key, got ${status}`);
	}

	// 3) Valid key but invalid payload -> 400
	{
		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/intelligence/analyze',
			body: { deals: 'nope' },
			headers: { 'x-api-key': process.env.API_KEY },
		});
		assert(status === 400, `expected 400 when deals is not an array, got ${status}`);
		assert(json?.error === 'deals must be an array', 'expected deals must be an array error');
	}

	// 4) Happy path -> 200 and stable output keys
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
		];

		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/intelligence/analyze',
			body: { deals, now: '2025-12-21T00:00:00.000Z' },
			headers: { 'x-api-key': process.env.API_KEY },
		});

		assert(status === 200, `expected 200 for valid analyze call, got ${status}`);
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

	console.log('intelligence.smoke: PASS');
})().catch((err) => {
	console.error('intelligence.smoke: FAIL');
	console.error(err);
	process.exit(1);
});
