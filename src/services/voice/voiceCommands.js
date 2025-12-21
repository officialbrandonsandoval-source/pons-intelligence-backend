const { analyzeRevenue } = require('../../ai/insightEngine');
const { getDeals } = require('../hubspot/deals');
const { getToken, isTokenExpired } = require('../tokenStore');
const { logError } = require('../../utils/logger');

const normalize = (text = '') => text.toLowerCase();

const INTENTS = {
	ANALYZE: 'analyze pipeline',
	TOP_ACTION: 'top action',
	LEAKS: 'revenue leaks',
	RANKED: 'ranked deals',
	REFRESH: 'refresh data',
};

const detectSource = (text) => {
	const t = normalize(text);
	if (t.includes('hubspot')) return 'hubspot';
	if (t.includes('go high') || t.includes('gohigh') || t.includes('ghl')) return 'ghl';
	return null;
};

const detectIntent = (text) => {
	const t = normalize(text);
	if (t.includes('refresh')) return INTENTS.REFRESH;
	if (t.includes('top action') || t.includes('next action')) return INTENTS.TOP_ACTION;
	if (t.includes('leak')) return INTENTS.LEAKS;
	if (t.includes('rank') || t.includes('ranking') || t.includes('priority')) return INTENTS.RANKED;
	if (t.includes('pipeline') || t.includes('analyze')) return INTENTS.ANALYZE;
	return INTENTS.ANALYZE;
};

const fetchCRMData = async ({ source, userId = 'dev' }) => {
	if (source === 'hubspot') {
		const token = getToken(userId);
		if (!token) throw new Error('HubSpot not authorized');
		if (isTokenExpired(token)) throw new Error('HubSpot token expired');
		return getDeals(token);
	}
	if (source === 'ghl') {
		throw new Error('GoHighLevel voice fetch not implemented');
	}
	throw new Error('CRM data is required for this command');
};

const summarize = (intent, insight) => {
	const leaks = insight?.revenueLeaks || [];
	const priorities = insight?.priorities || [];
	const topAction = insight?.topAction;
	const impact = insight?.revenueImpact;

	switch (intent) {
		case INTENTS.TOP_ACTION:
			return topAction || 'Top action not available yet.';
		case INTENTS.LEAKS:
			return leaks.length
				? `Largest leak: ${leaks[0].description}.`
				: 'No revenue leaks detected.';
		case INTENTS.RANKED:
			return priorities.length
				? `Top deal: ${priorities[0].name || priorities[0].id} (score ${priorities[0].score}).`
				: 'No ranked deals available.';
		case INTENTS.REFRESH:
			return topAction ? `Insights refreshed. ${topAction}` : 'Insights refreshed.';
		case INTENTS.ANALYZE:
		default:
			return topAction || 'Pipeline analyzed.';
	}
};

const executeVoiceCommand = async ({ transcript, source, userId = 'dev', data }) => {
	const intent = detectIntent(transcript || '');
	const resolvedSource = source || detectSource(transcript || '');

	let crmData = data;
	if (!crmData) {
		crmData = await fetchCRMData({ source: resolvedSource, userId });
	}

	const insight = await analyzeRevenue(crmData);
	const responseText = summarize(intent, insight);

	return {
		intent,
		source: resolvedSource,
		insight,
		responseText,
	};
};

module.exports = { executeVoiceCommand, INTENTS };
