const STAGE_ORDER = [
	'new',
	'prospecting',
	'qualify',
	'qualification',
	'discovery',
	'proposal',
	'negotiation',
	'contract',
	'decision',
	'closedwon',
	'won',
	'closedlost',
	'lost',
];

const normalizeStage = (stage) => (stage ? String(stage).toLowerCase().trim() : '');

const getStageRank = (stage) => {
	const normalized = normalizeStage(stage);
	const idx = STAGE_ORDER.indexOf(normalized);
	return idx >= 0 ? idx : 0;
};

const normalizeAmount = (lead = {}) => {
	const raw =
		lead.amount !== undefined
			? lead.amount
			: lead.value !== undefined
				? lead.value
				: lead.revenue !== undefined
					? lead.revenue
					: 0;
	const num = Number(raw);
	if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
	return Math.max(0, num);
};

const daysSince = (dateValue) => {
	if (!dateValue) return Infinity;
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return Infinity;
	const diffMs = Date.now() - date.getTime();
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const getLastContact = (lead = {}) => {
	return (
		lead.lastContact ||
		lead.last_contact ||
		lead.lastContactAt ||
		lead.lastActivity ||
		lead.last_activity ||
		lead.lastActivityAt ||
		lead.updatedAt ||
		lead.modifiedAt ||
		lead.closeDate ||
		lead.closedate ||
		''
	);
};

const getLeadIdentifier = (lead = {}) => {
	return lead.id || lead.leadId || lead.name || lead.company || 'lead';
};

module.exports = {
	STAGE_ORDER,
	normalizeStage,
	getStageRank,
	normalizeAmount,
	daysSince,
	getLastContact,
	getLeadIdentifier,
};
