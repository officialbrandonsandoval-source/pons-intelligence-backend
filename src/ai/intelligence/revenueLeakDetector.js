const { daysSince, getLeadIdentifier, getStageRank, normalizeAmount } = require('./common');

const isHighValue = (amount) => amount >= 50000;

const detectRevenueLeaks = (leads = []) => {
	const leaks = [];

	(leads || []).forEach((lead) => {
		const amount = normalizeAmount(lead);
		const leadId = getLeadIdentifier(lead);
		const days = lead.daysSinceLastContact ?? daysSince(lead.lastContact);
		const stageRank = lead.stageRank ?? getStageRank(lead.stage);

		if (days !== Infinity && days >= 14) {
			leaks.push({
				leadId,
				description: `No contact for ${days} days`,
				riskAmount: amount,
			});
		}

		if (isHighValue(amount) && days !== Infinity && days >= 10) {
			leaks.push({
				leadId,
				description: 'High-value deal appears stalled; engage decisively',
				riskAmount: amount,
			});
		}

		if (stageRank >= 3 && (days === Infinity || days >= 7)) {
			leaks.push({
				leadId,
				description: 'Late-stage deal with low recent activity',
				riskAmount: amount,
			});
		}
	});

	return leaks;
};

module.exports = { detectRevenueLeaks };
