const { daysSince } = require('./common');

const keepLead = (lead) => {
	const amount = lead.amount ?? 0;
	const days = lead.daysSinceLastContact ?? daysSince(lead.lastContact);
	if (!amount || amount <= 0) return false;
	if (days === null || days === undefined) return false;
	if (days === Infinity) return false;
	return days <= 90;
};

const prioritizeDeals = (leads = []) => {
	const filtered = (leads || []).filter((lead) => keepLead(lead));
	return filtered.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return (b.amount ?? 0) - (a.amount ?? 0);
	});
};

module.exports = { prioritizeDeals };
