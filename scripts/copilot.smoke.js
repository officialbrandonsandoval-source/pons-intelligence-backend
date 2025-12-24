/* eslint-disable no-console */

// No-deps smoke test for POST /api/copilot.
// Contract:
// Input: { query: string }
// Behavior:
// - If no CRM connected, uses mocked deals (deterministic)
// - Runs analyzeRevenue() and returns:
//   { answer: string, structured: { ...analyzeRevenue output... } }

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

	// 1) Missing query -> 400
	{
		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/copilot',
			body: {},
		});
		assert(status === 400, `expected 400 when query missing, got ${status}`);
		assert(json?.error === 'query_required', 'expected query_required error');
	}

	// 2) Happy path (no CRM connected) -> 200 with {answer, structured}
	{
		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/copilot',
			body: { query: 'What is at risk?', now: '2025-12-21T00:00:00.000Z' },
		});
		assert(status === 200, `expected 200, got ${status}`);
		assert(typeof json?.answer === 'string', 'expected answer string');
		assert(json?.structured && typeof json.structured === 'object', 'expected structured object');
		assert(typeof json.structured.voiceSummary === 'string', 'expected structured.voiceSummary');
		assert(!!json.structured.cashAtRisk, 'expected structured.cashAtRisk');
		assert(Array.isArray(json.structured.prioritizedDeals), 'expected structured.prioritizedDeals');
	}

	console.log('copilot.smoke: PASS');
})().catch((err) => {
	console.error('copilot.smoke: FAIL');
	console.error(err);
	process.exit(1);
});
