// CORE INTELLIGENCE: Revenue Leak Detector
//
// Purpose:
// Identify revenue loss patterns in a deterministic, voice-ready way.
//
// Leak types:
// - STALLED_DEAL (no activity > X days)
// - GHOSTED (late stage + silence)
// - OVERQUALIFIED (too long in early stage)
// - LOW_PROB_HIGH_VALUE (wishful thinking)
// - DEAD_LEAD (0 activity, 0 movement)
//
// Output:
// RevenueLeak[] sorted by severity then amount.
//
// Export:
// detectRevenueLeaks(deals, now)

const { getStageRank, normalizeStage } = require('./intelligence/common');

const asDate = (d) => {
	if (!d) return null;
	const dt = d instanceof Date ? d : new Date(d);
	return Number.isNaN(dt.getTime()) ? null : dt;
};

const daysBetween = (a, b) => {
	const A = asDate(a);
	const B = asDate(b);
	if (!A || !B) return null;
	const diffMs = B.getTime() - A.getTime();
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const ensureNumber = (n, fallback = 0) => {
	const x = Number(n);
	return Number.isFinite(x) ? x : fallback;
};

const clamp = (x, min, max) => Math.min(max, Math.max(min, x));

const normalizeProbability = (deal) => {
	const p = deal?.probability;
	if (p === null || p === undefined || p === '') {
		// Unknown probability: infer softly from stage.
		const stageRank = getStageRank(deal?.stage);
		return clamp(0.15 + stageRank * 0.07, 0.05, 0.95);
	}
	const n = Number(p);
	if (!Number.isFinite(n)) return 0.25;
	if (n > 1) return clamp(n / 100, 0.01, 0.99);
	return clamp(n, 0.01, 0.99);
};

const severityRank = (s) => {
	if (s === 'high') return 3;
	if (s === 'medium') return 2;
	return 1;
};

const leak = ({ dealId, type, severity, amountAtRisk, explanation }) => ({
	dealId: String(dealId),
	type,
	severity,
	amountAtRisk,
	explanation,
});

const detectRevenueLeaks = (deals = [], now = new Date()) => {
	const nowDate = asDate(now) || new Date();

	const leaks = [];

	for (const deal of deals || []) {
		const id = deal?.id || deal?.dealId || deal?.name || 'deal';
		const amount = ensureNumber(deal?.amount, 0);
		const stageRank = getStageRank(deal?.stage);
		const stage = normalizeStage(deal?.stage);
		const prob = normalizeProbability(deal);

		const lastActivityAt = deal?.lastActivityAt;
		const stageChangedAt = deal?.stageChangedAt;
		const createdAt = deal?.createdAt;

		const daysSinceActivity = lastActivityAt ? daysBetween(lastActivityAt, nowDate) : null;
		const daysInStage = stageChangedAt ? daysBetween(stageChangedAt, nowDate) : null;
		const ageDays = createdAt ? daysBetween(createdAt, nowDate) : null;

		// DEAD_LEAD: 0 activity, 0 movement
		// Interprets "0 movement" as missing stageChangedAt (or equal to createdAt) AND missing stageHistory.
		const hasStageHistory = Array.isArray(deal?.stageHistory) && deal.stageHistory.length > 0;
		const stageChangeKnown = !!asDate(stageChangedAt);
		const likelyNoMovement = !hasStageHistory && !stageChangeKnown;
		if (!lastActivityAt && likelyNoMovement && amount > 0) {
			leaks.push(
				leak({
					dealId: id,
					type: 'DEAD_LEAD',
					severity: 'high',
					amountAtRisk: amount,
					explanation:
						'Dead lead: there is no recorded activity and no stage movement. Disqualify or restart the conversation immediately.',
				})
			);
		}

		// STALLED_DEAL: no activity > X days
		const stalledDays = 14;
		if (daysSinceActivity !== null && daysSinceActivity > stalledDays && amount > 0) {
			const severity = daysSinceActivity >= 30 || amount >= 100000 ? 'high' : 'medium';
			leaks.push(
				leak({
					dealId: id,
					type: 'STALLED_DEAL',
					severity,
					amountAtRisk: amount,
					explanation: `Stalled deal: no activity for ${daysSinceActivity} days. Re-engage and secure a next step today.`,
				})
			);
		}

		// GHOSTED: late stage + silence
		// Late stage defined as stageRank >= 5 (proposal/negotiation/contract+ in this repo's stage list)
		if (stageRank >= 5 && daysSinceActivity !== null && daysSinceActivity >= 10 && amount > 0) {
			const severity = amount >= 75000 ? 'high' : 'medium';
			leaks.push(
				leak({
					dealId: id,
					type: 'GHOSTED',
					severity,
					amountAtRisk: amount,
					explanation: `Ghosted: late-stage deal (${stage || 'late stage'}) with ${daysSinceActivity} days of silence. Call the decision maker and confirm commitment.`,
				})
			);
		}

		// OVERQUALIFIED: too long in early stage
		// Early stage defined as stageRank <= 2 (new/prospecting/qualify).
		if (stageRank <= 2 && daysInStage !== null && daysInStage >= 21 && amount > 0) {
			const severity = daysInStage >= 45 ? 'high' : 'medium';
			leaks.push(
				leak({
					dealId: id,
					type: 'OVERQUALIFIED',
					severity,
					amountAtRisk: amount,
					explanation: `Overqualified: stuck in an early stage for ${daysInStage} days. Either advance to a real next step or disqualify.`,
				})
			);
		}

		// LOW_PROB_HIGH_VALUE: wishful thinking
		if (amount >= 75000 && prob <= 0.25) {
			leaks.push(
				leak({
					dealId: id,
					type: 'LOW_PROB_HIGH_VALUE',
					severity: 'high',
					amountAtRisk: amount,
					explanation:
						'Wishful thinking: high-value deal with low close probability. Validate qualification, tighten the next step, or re-forecast realistically.',
				})
			);
		}

		// Additional DEAD_LEAD scenario: no activity for a long time AND no stage movement info.
		if (daysSinceActivity !== null && daysSinceActivity >= 60 && likelyNoMovement && amount > 0) {
			leaks.push(
				leak({
					dealId: id,
					type: 'DEAD_LEAD',
					severity: 'high',
					amountAtRisk: amount,
					explanation:
						'Dead lead: extended silence with no evidence of progress. Close it out or restart with a clear qualification checkpoint.',
				})
			);
		}
	}

	leaks.sort((a, b) => {
		const s = severityRank(b.severity) - severityRank(a.severity);
		if (s !== 0) return s;
		return (b.amountAtRisk || 0) - (a.amountAtRisk || 0);
	});

	return leaks;
};

module.exports = { detectRevenueLeaks };
