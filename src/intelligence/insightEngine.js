// CORE INTELLIGENCE BRAIN (deterministic)
//
// Rules:
// - No UI logic
// - No console noise
// - Deterministic outputs
// - Pure functions (no network, no env)
// - Structured JSON responses
// - Optimized for voice explanation
//
// This module intentionally mirrors the engine used elsewhere in the codebase
// so external callers can depend on a stable, deterministic contract.

const { scoreLeads } = require('./leadScoring');
const { rankDeals } = require('../dealPrioritization');
const { detectRevenueLeaks } = require('../revenueLeakDetector');
const { getLeadIdentifier, normalizeAmount } = require('./common');

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

const computeCashAtRisk = ({ deals = [], now }) => {
	// cashAtRisk = deals stalled > 14 days with amount > 0
	// "stalled" means no activity (lastActivityAt) in > 14 days relative to now.
	const nowDate = asDate(now) || new Date();
	let amount = 0;
	let count = 0;
	const dealIds = [];

	for (const deal of deals || []) {
		const dealAmount = ensureNumber(deal?.amount, 0);
		if (!(dealAmount > 0)) continue;
		const lastActivityAt = deal?.lastActivityAt;
		const days = lastActivityAt ? daysBetween(lastActivityAt, nowDate) : null;
		if (days === null) continue;
		if (days <= 14) continue;
		const id = deal?.id || getLeadIdentifier(deal);
		dealIds.push(String(id));
		count += 1;
		amount += dealAmount;
	}

	return { amount, count, deals: dealIds };
};

const computeVelocity = ({ deals = [], now }) => {
	// velocity = based on stage progression timestamps
	//
	// Assumption: normalized Deal may optionally include one of these fields:
	// - stageHistory: [{ stage, at }]
	// - stageChangedAt
	// If stage progression timestamps are missing, we default to stable with explanation.
	const nowDate = asDate(now) || new Date();
	const msWeek = 7 * 24 * 60 * 60 * 1000;
	const weekStart = new Date(nowDate.getTime() - msWeek);
	const prevWeekStart = new Date(nowDate.getTime() - 2 * msWeek);

	let progressedThisWeek = 0;
	let progressedPrevWeek = 0;
	let observed = 0;

	for (const deal of deals || []) {
		const history = Array.isArray(deal?.stageHistory) ? deal.stageHistory : null;
		if (history && history.length) {
			// Count a progression event if there are 2+ stages and the latest stage differs from the earliest.
			const sorted = [...history]
				.map((h) => ({ stage: h?.stage, at: asDate(h?.at) }))
				.filter((h) => h.at)
				.sort((a, b) => a.at.getTime() - b.at.getTime());
			if (sorted.length < 2) continue;

			observed += 1;
			const stageChangedAt = sorted[sorted.length - 1].at;
			const firstStage = String(sorted[0].stage || '');
			const lastStage = String(sorted[sorted.length - 1].stage || '');
			const progressed = firstStage && lastStage && firstStage !== lastStage;
			if (!progressed) continue;

			if (stageChangedAt >= weekStart) progressedThisWeek += 1;
			else if (stageChangedAt >= prevWeekStart && stageChangedAt < weekStart) progressedPrevWeek += 1;
			continue;
		}

		const changedAt = asDate(deal?.stageChangedAt);
		if (!changedAt) continue;
		observed += 1;
		if (changedAt >= weekStart) progressedThisWeek += 1;
		else if (changedAt >= prevWeekStart && changedAt < weekStart) progressedPrevWeek += 1;
	}

	if (observed === 0) {
		return {
			status: 'stable',
			percentChange: 0,
			explanation:
				'No stage progression timestamps were provided, so velocity is reported as stable. Add stageHistory or stageChangedAt to enable true stage-based velocity.',
		};
	}

	let percentChange = 0;
	if (progressedPrevWeek === 0) {
		percentChange = progressedThisWeek > 0 ? 100 : 0;
	} else {
		percentChange = Math.round(((progressedThisWeek - progressedPrevWeek) / progressedPrevWeek) * 100);
	}

	let status = 'stable';
	if (percentChange >= 10) status = 'accelerating';
	else if (percentChange <= -10) status = 'slowing';

	const explanation =
		status === 'accelerating'
			? `Stage movement is up ${percentChange}% week-over-week.`
			: status === 'slowing'
				? `Stage movement is down ${Math.abs(percentChange)}% week-over-week.`
				: 'Stage movement is steady week-over-week.';

	return { status, percentChange, explanation };
};

const buildVoiceSummary = ({ cashAtRisk, velocity, nextBestAction }) => {
	// 2–3 sentences, concise, direct.
	const riskPart =
		cashAtRisk.count > 0
			? `Cash at risk is $${Math.round(cashAtRisk.amount).toLocaleString()} across ${cashAtRisk.count} stalled deals.`
			: 'No stalled deals are currently flagged as cash at risk.';
	const velocityPart = `Revenue velocity is ${velocity.status} (${velocity.percentChange}% week over week).`;
	const actionPart = nextBestAction?.dealId
		? `Next, ${nextBestAction.action} on deal ${nextBestAction.dealId}.`
		: `Next, ${nextBestAction.action}.`;
	return `${riskPart} ${velocityPart} ${actionPart}`.trim();
};

// Export a single async function: analyzeRevenue()
const analyzeRevenue = async (input = {}) => {
	const deals = Array.isArray(input?.deals) ? input.deals : [];
	const now = input?.now ? input.now : undefined;

	// Normalize deals into the internal lead scoring format.
	const scored = scoreLeads(
		deals.map((d) => ({
			...d,
			amount: ensureNumber(d?.amount, normalizeAmount(d)),
			lastActivityAt: d?.lastActivityAt || null,
		}))
	);

	const prioritizedDeals = rankDeals(deals, now ? new Date(now) : new Date());
	const revenueLeaks = detectRevenueLeaks(scored);

	const cashAtRisk = computeCashAtRisk({ deals, now });
	const velocity = computeVelocity({ deals, now });

	// nextBestAction = highest ROI deal from prioritization
	const top = prioritizedDeals[0];
	const dealId = top ? String(top.dealId) : null;
	const nextBestAction = {
		dealId,
		action: top ? top.recommendedAction : 'Review pipeline and create next-step commitments',
		impact: top ? `Protect/advance $${Math.round(top.amount).toLocaleString()}` : 'Unknown',
		reason: top ? top.explanation : 'No eligible deals were prioritized.',
	};

	const voiceSummary = buildVoiceSummary({ cashAtRisk, velocity, nextBestAction });

	return {
		cashAtRisk,
		velocity,
		nextBestAction,
		prioritizedDeals,
		revenueLeaks,
		voiceSummary,
	};
};

module.exports = { analyzeRevenue };
