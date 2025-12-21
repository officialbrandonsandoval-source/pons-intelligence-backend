const {
	getStageRank,
	normalizeAmount,
	daysSince,
	getLastContact,
	STAGE_ORDER,
	normalizeStage,
} = require('./common');

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

const scoreLead = (lead) => {
	const amount = normalizeAmount(lead);
	const stageRank = getStageRank(lead.stage || lead.stageName);
	const lastContact = getLastContact(lead);
	const days = daysSince(lastContact);

	const valueScore = clamp((amount / 100000) * 50, 0, 50); // caps at $100k
	const stageScore = clamp((stageRank / (STAGE_ORDER.length - 1)) * 30, 0, 30);
	const recencyScore = days === Infinity ? 0 : clamp(((90 - days) / 90) * 20, 0, 20);

	const score = clamp(valueScore + stageScore + recencyScore, 0, 100);

	return {
		...lead,
		amount,
		stage: normalizeStage(lead.stage || lead.stageName),
		stageRank,
		lastContact,
		daysSinceLastContact: days === Infinity ? null : days,
		score: Math.round(score),
	};
};

const scoreLeads = (leads = []) => leads.map(scoreLead);

module.exports = { scoreLeads };
