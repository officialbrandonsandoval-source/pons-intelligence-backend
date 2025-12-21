const { Anthropic } = require('@anthropic-ai/sdk');
const { logger } = require('../utils/logger');
const { callWithRetry } = require('../utils/apiWrapper');
const { scoreLeads } = require('./intelligence/leadScoring');
const { prioritizeDeals } = require('./intelligence/dealPrioritization');
const { detectRevenueLeaks } = require('./intelligence/revenueLeakDetector');
const { buildActionPlan } = require('./intelligence/actionRecommendations');
const { getLeadIdentifier } = require('./intelligence/common');

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = 'claude-3-haiku-20240307';

const client = apiKey ? new Anthropic({ apiKey }) : null;

const parseJsonOrThrow = (text) => {
	try {
		return JSON.parse(text);
	} catch (err) {
		throw new Error('Invalid model response: expected JSON');
	}
};

const ensureContract = (payload) => {
	const base = payload || {};
	const revenueLeaks = Array.isArray(base.revenueLeaks) ? base.revenueLeaks : [];
	const priorities = Array.isArray(base.priorities) ? base.priorities : [];
	const topAction = (base.topAction || '').trim();
	const revenueImpact = base.revenueImpact || base.estimatedRevenueImpact || 'Unknown';
	const priority = base.priority || base.priorityLevel || 'medium';
	const supportingActions = Array.isArray(base.supportingActions) ? base.supportingActions : [];

	if (revenueLeaks.length === 0 && priorities.length === 0) {
		throw new Error('No priorities or revenue leaks were detected');
	}

	if (!topAction) {
		throw new Error('topAction is required');
	}

	return {
		revenueLeaks,
		priorities,
		topAction,
		revenueImpact,
		priority,
		supportingActions,
	};
};

const buildFindings = (data) => {
	if (!data || !Array.isArray(data.leads)) {
		throw new Error('CRM data with leads is required');
	}

	const scoredLeads = scoreLeads(data.leads);
	const prioritized = prioritizeDeals(scoredLeads);
	const revenueLeaks = detectRevenueLeaks(scoredLeads);
	const actionPlan = buildActionPlan(prioritized, revenueLeaks);

	const priorities = prioritized.map((lead) => ({
		id: getLeadIdentifier(lead),
		name: lead.name || lead.company || getLeadIdentifier(lead),
		score: lead.score,
		amount: lead.amount,
		stage: lead.stage,
		lastContact: lead.lastContact || null,
		daysSinceLastContact: lead.daysSinceLastContact ?? null,
	}));

	return {
		revenueLeaks,
		priorities,
		topAction: actionPlan.topAction,
		supportingActions: actionPlan.supportingActions,
		revenueImpact: actionPlan.estimatedRevenueImpact,
		priority: actionPlan.priorityLevel,
	};
};

const askAnthropicToFormat = async (findings) => {
	const response = await callWithRetry(() =>
		client.messages.create({
			model,
			temperature: 0,
			max_tokens: 300,
			messages: [
				{
					role: 'user',
					content: `You are a revenue editor. Given deterministic findings, return ONLY JSON using the same schema. Do not add or remove items; only tighten wording for text fields. Keep arrays intact.\nFindings:\n${JSON.stringify(findings, null, 2)}`,
				},
			],
		})
	);

	const text = response?.content?.[0]?.text || '';
	logger.debug('Anthropic revenue formatter received');
	return parseJsonOrThrow(text.trim());
};

const analyzeRevenue = async (data) => {
	const findings = buildFindings(data);
	const contract = ensureContract(findings);

	if (!client) {
		logger.warn('Anthropic client not configured; returning deterministic intelligence only');
		return contract;
	}

	try {
		const formatted = await askAnthropicToFormat(contract);
		const merged = ensureContract({
			...contract,
			...formatted,
			revenueLeaks: formatted.revenueLeaks ?? contract.revenueLeaks,
			priorities: formatted.priorities ?? contract.priorities,
		});
		return merged;
	} catch (err) {
		logger.warn('Anthropic formatting failed, returning deterministic contract', { error: err.message });
		return contract;
	}
};

module.exports = { analyzeRevenue };
