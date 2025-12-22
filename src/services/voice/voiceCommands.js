const intelligenceRouter = require('../../flow/intelligenceRouter');

const normalize = (text = '') => String(text || '').toLowerCase();

const INTENTS = {
	SUMMARY: 'summary',
	NEXT_ACTION: 'next_action',
	RISKS: 'risks',
	VELOCITY: 'velocity',
};

const detectSource = (text) => {
	const t = normalize(text);
	if (t.includes('hubspot')) return 'hubspot';
	if (t.includes('go high') || t.includes('gohigh') || t.includes('ghl')) return 'gohighlevel';
	return null;
};

const parseVoiceCommand = ({ transcript }) => {
	const t = normalize(transcript);
	// Intent only. No analysis.
	let intent = INTENTS.SUMMARY;

	if (t.includes('next') || t.includes('top action') || t.includes('what should i do')) {
		intent = INTENTS.NEXT_ACTION;
	} else if (t.includes('risk') || t.includes('at risk') || t.includes('leak')) {
		intent = INTENTS.RISKS;
	} else if (t.includes('velocity') || t.includes('slowing') || t.includes('accelerat')) {
		intent = INTENTS.VELOCITY;
	} else if (t.includes('summary') || t.includes('pipeline') || t.includes('analy')) {
		intent = INTENTS.SUMMARY;
	}

	return {
		intent,
		source: detectSource(t),
	};
};

const renderVoiceResponse = ({ intent, insight }) => {
	const nextBest = insight?.nextBestAction;
	const cashAtRisk = insight?.cashAtRisk;
	const velocity = insight?.velocity;

	// Direct, minimal numbers, one action at a time.
	const actionText = nextBest?.action ? String(nextBest.action).trim() : '';
	const actionReason = nextBest?.reason ? String(nextBest.reason).trim() : '';

	const riskHint = (() => {
		const count = Number(cashAtRisk?.count || 0);
		if (count <= 0) return '';
		if (count === 1) return 'One deal is at risk.';
		return `${count} deals are at risk.`;
	})();

	const velocityHint = (() => {
		const status = velocity?.status;
		if (status === 'accelerating') return 'Momentum is picking up.';
		if (status === 'slowing') return 'Momentum is slowing.';
		return 'Momentum looks stable.';
	})();

	switch (intent) {
		case INTENTS.NEXT_ACTION:
			return actionText
				? `Do this next: ${actionText}${actionReason ? ` — ${actionReason}` : ''}`
				: 'Your next best action is not available yet.';
		case INTENTS.RISKS:
			return riskHint || 'No deals are flagged at risk right now.';
		case INTENTS.VELOCITY:
			return velocityHint;
		case INTENTS.SUMMARY:
		default: {
			// One action at a time: lead with NBA, then only 1 short supporting signal.
			if (actionText) {
				return `Today’s focus: ${actionText}. ${riskHint || velocityHint}`;
			}
			return riskHint || velocityHint;
		}
	}
};

const callIntelligenceInternally = (reqHeaders, payload) =>
	new Promise((resolve, reject) => {
		const fakeReq = {
			body: payload,
			headers: {
				...reqHeaders,
				'x-api-key': reqHeaders?.['x-api-key'] || reqHeaders?.['X-API-KEY'],
			},
			method: 'POST',
			url: '/intelligence/analyze',
		};

		const fakeRes = {
			statusCode: 200,
			status(code) {
				this.statusCode = code;
				return this;
			},
			json(body) {
				if (this.statusCode >= 400) {
					const msg = body?.error || 'Intelligence call failed';
					return reject(new Error(msg));
				}
				return resolve(body);
			},
		};

		intelligenceRouter.handle(fakeReq, fakeRes, (err) => {
			if (err) reject(err);
		});
	});

const executeVoiceCommand = async ({
	transcript,
	source,
	userId = 'dev',
	data,
	// Allows reuse from HTTP route code: pass through headers so auth stays consistent.
	headers = {},
}) => {
	const parsed = parseVoiceCommand({ transcript });

	const resolvedSource = source || parsed.source;
	if (!resolvedSource) {
		throw new Error('source is required');
	}
	if (!['hubspot', 'gohighlevel'].includes(resolvedSource)) {
		throw new Error('source must be "hubspot" or "gohighlevel"');
	}

	const payload = {
		source: resolvedSource,
		userId,
		// Optional injection for troubleshooting/tests
		data,
	};

	const result = await callIntelligenceInternally(headers, payload);
	const insight = result?.insight;
	const responseText = renderVoiceResponse({ intent: parsed.intent, insight });

	return {
		intent: parsed.intent,
		source: resolvedSource,
		insight,
		responseText,
	};
};

module.exports = { parseVoiceCommand, executeVoiceCommand, INTENTS };
