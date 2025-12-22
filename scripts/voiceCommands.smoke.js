/* eslint-disable no-console */

const assert = (cond, msg) => {
	if (!cond) throw new Error(`ASSERT: ${msg}`);
};

const { parseVoiceCommand, executeVoiceCommand, INTENTS } = require('../src/services/voice/voiceCommands');

const requestJson = async ({ app, method, path, body, apiKey }) => {
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

	// parseVoiceCommand => intent only
	{
		const parsed = parseVoiceCommand({ transcript: 'What is my next action in HubSpot?' });
		assert(parsed.intent === INTENTS.NEXT_ACTION, 'expected NEXT_ACTION intent');
		assert(parsed.source === 'hubspot', 'expected hubspot source');
	}

	// executeVoiceCommand uses intelligenceRouter (via headers + data injection)
	{
		const headers = { 'x-api-key': process.env.API_KEY };
		const data = { leads: [], metadata: { source: 'hubspot', total: 0 } };
		const out = await executeVoiceCommand({
			transcript: 'Give me a quick summary',
			source: 'hubspot',
			userId: 'dev',
			data,
			headers,
		});
		assert(typeof out.responseText === 'string' && out.responseText.length > 0, 'expected responseText');
		assert(!out.responseText.includes('$'), 'avoid number overload / currency formatting');
	}

	// Sanity check: calling the HTTP endpoint directly also works for empty leads
	{
		const { status, json } = await requestJson({
			app,
			method: 'POST',
			path: '/api/intelligence/analyze',
			apiKey: process.env.API_KEY,
			body: { source: 'hubspot', userId: 'dev', data: { leads: [], metadata: { source: 'hubspot', total: 0 } } },
		});
		assert(status === 200, 'expected 200');
		assert(!!json?.insight, 'expected insight');
	}

	console.log('voiceCommands.smoke: PASS');
})().catch((err) => {
	console.error('voiceCommands.smoke: FAIL');
	console.error(err);
	process.exit(1);
});
