/* eslint-disable no-console */

const assert = (cond, msg) => {
	if (!cond) throw new Error(`ASSERT: ${msg}`);
};

const requestJson = async ({ app, method, path, body, apiKey }) => {
	// Use Node 18+ global fetch.
	const server = app.listen(0);
	try {
		const { port } = server.address();
		const res = await fetch(`http://127.0.0.1:${port}${path}`, {
			method,
			headers: {
				'content-type': 'application/json',
				'x-api-key': apiKey,
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
	process.env.API_KEY = process.env.API_KEY || 'test-key';
	const app = require('../src/index');

	// 1) No CRM connected => 400
	{
		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/intelligence/analyze',
			apiKey: process.env.API_KEY,
			body: { source: 'hubspot', userId: 'user-no-token' },
		});
		assert(status === 400, 'expected 400 when HubSpot not authorized');
		assert(
			String(json?.error || '').toLowerCase().includes('hubspot') &&
				String(json?.error || '').toLowerCase().includes('authorized'),
			'expected hubspot not authorized error message'
		);
	}

	// 2) Empty deals => returns empty intelligence (not error)
	{
		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/intelligence/analyze',
			apiKey: process.env.API_KEY,
			body: {
				source: 'hubspot',
				userId: 'dev',
				data: { leads: [], metadata: { source: 'hubspot', total: 0 } },
			},
		});
		assert(status === 200, 'expected 200 for empty deals');
		assert(!!json?.insight, 'expected insight object');
		assert(Array.isArray(json.insight.prioritizedDeals), 'expected prioritizedDeals array');
		assert(Array.isArray(json.insight.revenueLeaks), 'expected revenueLeaks array');
		assert(typeof json.insight.voiceSummary === 'string', 'expected voiceSummary string');
		assert(json.insight.cashAtRisk?.amount === 0, 'expected cashAtRisk.amount = 0 for empty');
		assert(json.insight.cashAtRisk?.count === 0, 'expected cashAtRisk.count = 0 for empty');
	}

	console.log('intelligenceRouter.smoke: PASS');
})().catch((err) => {
	console.error('intelligenceRouter.smoke: FAIL');
	console.error(err);
	process.exit(1);
});
