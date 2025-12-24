const getLeadIdentifier = (deal) => {
	if (!deal) return 'unknown';
	const id = deal.id || deal.dealId || deal.leadId || deal.name;
	return id ? String(id) : 'unknown';
};

const normalizeAmount = (deal) => {
	const v = deal?.amount;
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};

module.exports = { getLeadIdentifier, normalizeAmount };
