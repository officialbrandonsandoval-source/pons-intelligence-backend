const { getLeadIdentifier, normalizeAmount } = require('./common');

const formatCurrency = (amount) => {
	if (!amount || Number.isNaN(amount)) return 'Unknown';
	return `$${Math.round(amount).toLocaleString()}`;
};

const buildActionPlan = (prioritized = [], leaks = []) => {
	const topLead = prioritized[0];
	const leadId = topLead ? getLeadIdentifier(topLead) : null;
	const leak = leaks[0];

	const supportingActions = [];
	let topAction = '';

	if (leak) {
		topAction = `Re-engage ${leak.leadId} immediately: ${leak.description}`;
		supportingActions.push('Schedule an executive follow-up within 24 hours');
	}

	if (!topAction && topLead) {
		const stageText = topLead.stage ? ` (${topLead.stage})` : '';
		topAction = `Advance ${leadId}${stageText} with a direct next-step ask today`;
		supportingActions.push('Send a tailored summary + CTA email now');
	}

	if (!topAction) {
		topAction = 'Focus on highest potential deals and create next-step commitments today';
	}

	if (prioritized[1]) {
		supportingActions.push(`Queue outreach to ${getLeadIdentifier(prioritized[1])} next`);
	}

	if (leaks.length > 1) {
		const additional = leaks.slice(1, 3).map((l) => `Address leak on ${l.leadId}: ${l.description}`);
		supportingActions.push(...additional);
	}

	const estimatedImpactValue =
		normalizeAmount(topLead || {}) +
		leaks.reduce((sum, l) => sum + normalizeAmount({ amount: l.riskAmount }), 0);

	const priorityLevel = estimatedImpactValue >= 100000 || leaks.some((l) => normalizeAmount(l) >= 50000)
		? 'high'
		: prioritized.length > 0
			? 'medium'
			: 'low';

	return {
		topAction,
		supportingActions,
		estimatedRevenueImpact: formatCurrency(estimatedImpactValue),
		priorityLevel,
	};
};

module.exports = { buildActionPlan };
