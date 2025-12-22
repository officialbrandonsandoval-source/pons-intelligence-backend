// CORE INTELLIGENCE: Deal Prioritization
//
// Purpose:
// Rank deals by REAL revenue priority.
//
// Scoring formula:
// priorityScore = amount * probabilityMultiplier * velocityMultiplier * recencyMultiplier
//
// Rules:
// - High value + late stage + recent activity = highest score
// - Old deals decay aggressively
// - Velocity multiplier penalizes long stage duration
// - Probability must be normalized if missing
//
// Output shape (per deal):
// {
//   dealId,
//   name,
//   amount,
//   score,
//   priority: "high" | "medium" | "low",
//   recommendedAction,
//   explanation
// }

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
		// If missing: infer from stage (late stage implies higher close likelihood)
		const stageRank = getStageRank(deal?.stage);
		// stage ranks are roughly 0..N; this maps to [0.15..0.85]
		return clamp(0.15 + stageRank * 0.07, 0.05, 0.95);
	}
	const n = Number(p);
	if (!Number.isFinite(n)) return 0.25;
	// Accept either 0..1 or 0..100
	if (n > 1) return clamp(n / 100, 0.01, 0.99);
	return clamp(n, 0.01, 0.99);
};

const computeRecencyMultiplier = (deal, now) => {
	// Old deals decay aggressively.
	// We use activity recency primarily, falling back to createdAt.
	const nowDate = asDate(now) || new Date();
	const last = deal?.lastActivityAt || deal?.lastActivity || deal?.lastActivityAt || deal?.updatedAt;
	const base = last || deal?.createdAt;
	const days = base ? daysBetween(base, nowDate) : null;
	if (days === null) return 0.4;

	// Aggressive decay after 14/30/60 days.
	if (days <= 7) return 1.15;
	if (days <= 14) return 1.0;
	if (days <= 30) return 0.7;
	if (days <= 60) return 0.35;
	return 0.12;
};

const computeVelocityMultiplier = (deal, now) => {
	// Velocity multiplier penalizes long stage duration.
	// Uses stageChangedAt when available, otherwise createdAt as a proxy.
	const nowDate = asDate(now) || new Date();
	const stageChangedAt = deal?.stageChangedAt || deal?.stageMovedAt;
	const base = stageChangedAt || deal?.createdAt;
	const days = base ? daysBetween(base, nowDate) : null;
	if (days === null) return 0.9;

	// Quick movers get a bump; stuck deals get penalized.
	if (days <= 3) return 1.15;
	if (days <= 7) return 1.0;
	if (days <= 14) return 0.85;
	if (days <= 30) return 0.6;
	return 0.35;
};

const computeProbabilityMultiplier = (prob) => {
	// Use probability as a multiplier in roughly [0.2..1.2]
	// so late stage + high probability meaningfully increases score.
	return clamp(0.2 + prob * 1.0, 0.15, 1.2);
};

const computeStageBoost = (deal) => {
	// Late stage should be higher priority.
	const stageRank = getStageRank(deal?.stage);
	// modest boost: early ~0.9, late ~1.25
	return clamp(0.9 + stageRank * 0.03, 0.85, 1.25);
};

const pickRecommendedAction = ({ deal, recencyDays, prob }) => {
	const stage = normalizeStage(deal?.stage);
	if (recencyDays !== null && recencyDays > 30) return 'Disqualify — no activity';

	if (stage.includes('proposal') || stage.includes('pricing')) return 'Send pricing follow-up';
	if (stage.includes('negotiation') || stage.includes('contract') || stage.includes('decision')) {
		return 'Call decision maker today';
	}
	if (prob >= 0.7) return 'Call decision maker today';
	return 'Send a clear next-step ask';
};

const buildExplanation = ({ amount, prob, recencyMultiplier, velocityMultiplier, stageBoost }) => {
	const pct = Math.round(prob * 100);
	return `Value $${Math.round(amount).toLocaleString()}, probability ${pct}%, recency x${recencyMultiplier.toFixed(
		2
	)}, velocity x${velocityMultiplier.toFixed(2)}, stage x${stageBoost.toFixed(2)}.`;
};

const rankDeals = (deals = [], now = new Date()) => {
	const nowDate = asDate(now) || new Date();

	const ranked = (deals || [])
		.map((deal) => {
			const amount = ensureNumber(deal?.amount, 0);
			const prob = normalizeProbability(deal);
			const probabilityMultiplier = computeProbabilityMultiplier(prob);
			const recencyMultiplier = computeRecencyMultiplier(deal, nowDate);
			const velocityMultiplier = computeVelocityMultiplier(deal, nowDate);
			const stageBoost = computeStageBoost(deal);

			const scoreRaw = amount * probabilityMultiplier * velocityMultiplier * recencyMultiplier * stageBoost;
			const score = Math.round(scoreRaw);

			const last = deal?.lastActivityAt || deal?.createdAt;
			const recencyDays = last ? daysBetween(last, nowDate) : null;

			let priority = 'low';
			if (score >= 75000) priority = 'high';
			else if (score >= 25000) priority = 'medium';

			const recommendedAction = pickRecommendedAction({ deal, recencyDays, prob });
			const explanation = buildExplanation({
				amount,
				prob,
				recencyMultiplier,
				velocityMultiplier,
				stageBoost,
			});

			return {
				dealId: String(deal?.id || deal?.dealId || deal?.name || 'deal'),
				name: deal?.name || 'Unnamed Deal',
				amount,
				score,
				priority,
				recommendedAction,
				explanation,
				// keep the original deal attached internally (not required by contract)
				__deal: deal,
			};
		})
		.filter((d) => d.amount > 0);

	ranked.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return b.amount - a.amount;
	});

	// Strip internal fields
	return ranked.map(({ __deal, ...rest }) => rest);
};

module.exports = { rankDeals };
