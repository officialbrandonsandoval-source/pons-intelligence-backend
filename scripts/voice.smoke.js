/* eslint-disable no-console */

// No-deps smoke test for voice demo routes mounted at /api/voice.
// Contract:
// - POST /api/voice/session/start
//   - Protected by x-api-key
//   - Returns { sessionId: "demo", ready: true }
// - POST /api/voice/command
//   - Protected by x-api-key
//   - Accepts JSON OR multipart/form-data
//   - Returns { transcript: "demo voice input", response: <voiceSummary>, audio: null }

const assert = (cond, msg) => {
	if (!cond) throw new Error(`ASSERT: ${msg}`);
};

const startServer = async () => {
	const app = require('../src/index');
	const server = app.listen(0);
	await new Promise((resolve) => server.once('listening', resolve));
	const port = server.address().port;
	return { server, baseUrl: `http://127.0.0.1:${port}` };
};

const postJson = async (url, body, headers = {}) => {
	return fetch(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify(body),
	});
};

(async () => {
	process.env.API_KEY = process.env.API_KEY || 'test_api_key';

	const { server, baseUrl } = await startServer();

	try {
		// session/start auth checks
		{
			const r = await postJson(`${baseUrl}/api/voice/session/start`, {});
			assert(r.status === 401, `expected 401 without key, got ${r.status}`);
		}
		{
			const r = await postJson(`${baseUrl}/api/voice/session/start`, {}, { 'x-api-key': 'wrong_key' });
			assert(r.status === 403, `expected 403 wrong key, got ${r.status}`);
		}
		{
			const r = await postJson(
				`${baseUrl}/api/voice/session/start`,
				{},
				{ 'x-api-key': process.env.API_KEY }
			);
			assert(r.status === 200, `expected 200, got ${r.status}`);
			const j = await r.json();
			assert(j?.sessionId === 'demo', 'expected sessionId="demo"');
			assert(j?.ready === true, 'expected ready=true');
		}

		// command auth checks
		{
			const r = await postJson(`${baseUrl}/api/voice/command`, { now: '2025-12-21T00:00:00.000Z' });
			assert(r.status === 401, `expected 401 without key, got ${r.status}`);
		}
		{
			const r = await postJson(
				`${baseUrl}/api/voice/command`,
				{ now: '2025-12-21T00:00:00.000Z' },
				{ 'x-api-key': 'wrong_key' }
			);
			assert(r.status === 403, `expected 403 wrong key, got ${r.status}`);
		}
		{
			const r = await postJson(
				`${baseUrl}/api/voice/command`,
				{ now: '2025-12-21T00:00:00.000Z' },
				{ 'x-api-key': process.env.API_KEY }
			);
			assert(r.status === 200, `expected 200, got ${r.status}`);
			const j = await r.json();
			assert(j?.transcript === 'demo voice input', 'expected demo transcript');
			assert(typeof j?.response === 'string', 'expected response string');
			assert(j?.audio === null, 'expected audio=null');
		}

		console.log('voice.smoke: PASS');
		process.exitCode = 0;
	} catch (err) {
		console.error('voice.smoke: FAIL');
		console.error(err && err.stack ? err.stack : err);
		process.exitCode = 1;
	} finally {
		await new Promise((resolve) => server.close(resolve));
	}
})();
