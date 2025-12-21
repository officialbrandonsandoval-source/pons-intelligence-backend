const { getLeadIdentifier, normalizeAmount, daysSince } = require('../../ai/intelligence/common');

const clampNumber = (n, fallback = 0) => {
	const x = Number(n);
	return Number.isFinite(x) ? x : fallback;
};

const computeCashAtRisk = ({ leads = [], insight }) => {
	// Definition:
	// - "at risk" deals are those flagged by the existing deterministic leak detector.
	// - We map leaks to deal IDs (leadId) and sum/count unique deals.
	const leaks = Array.isArray(insight?.revenueLeaks) ? insight.revenueLeaks : [];
	const riskIds = new Set(leaks.map((l) => l.leadId).filter(Boolean));

	let amount = 0;
	let count = 0;

	for (const lead of leads || []) {
		const id = getLeadIdentifier(lead);
		if (!riskIds.has(id)) continue;
		count += 1;
		amount += clampNumber(normalizeAmount(lead), 0);
	}

	return { amount, count };
};

const computeRevenueVelocity = ({ leads = [] }) => {
	// We try to compute a week-over-week delta using timestamps if present.
	// Supported optional fields (if the connector provides them):
	// - lead.stageChangedAt (ISO)
	// - lead.stageHistory: [{ stage, at }]
	// - lead.updatedAt (ISO)
	// If none exist (current HubSpot connector only provides stage/amount/closeDate),
	// we *infer* velocity using pipeline "freshness": stage mix + last-contact recency distribution.
	// This is an explicit approximation to satisfy the product requirement without adding deps.

	const now = Date.now();
	const msDay = 24 * 60 * 60 * 1000;
	const msWeek = 7 * msDay;

	const hasMovementSignals = (leads || []).some(
		(l) => l?.stageChangedAt || (Array.isArray(l?.stageHistory) && l.stageHistory.length) || l?.updatedAt
	);

	let wowPercent = 0;
	let label = 'Stable';

	if (hasMovementSignals) {
		let movedThisWeek = 0;
		let movedPrevWeek = 0;

		for (const lead of leads || []) {
			const dates = [];
			if (lead?.stageChangedAt) dates.push(new Date(lead.stageChangedAt).getTime());
			if (lead?.updatedAt) dates.push(new Date(lead.updatedAt).getTime());
			if (Array.isArray(lead?.stageHistory)) {
				for (const h of lead.stageHistory) {
					if (h?.at) dates.push(new Date(h.at).getTime());
				}
			}

			const latest = dates
				.map((t) => (Number.isFinite(t) ? t : null))
				.filter(Boolean)
				.sort((a, b) => b - a)[0];
			if (!latest) continue;

			if (latest >= now - msWeek) movedThisWeek += 1;
			else if (latest >= now - 2 * msWeek) movedPrevWeek += 1;
		}

		if (movedPrevWeek === 0) {
			wowPercent = movedThisWeek > 0 ? 100 : 0;
		} else {
			wowPercent = Math.round(((movedThisWeek - movedPrevWeek) / movedPrevWeek) * 100);
		}
	} else {
		// Inference mode:
		// - Compute a "freshness" score: percent of deals contacted in last 7 days.
		// - Compare with the share contacted in days 8-14 (previous week proxy).
		// - If lastContact isn't available either, default to Stable/0.
		let contactedThisWeek = 0;
		let contactedPrevWeek = 0;
		let haveLastContact = 0;

		for (const lead of leads || []) {
			const d = lead?.daysSinceLastContact ?? daysSince(lead?.lastContact);
			if (!Number.isFinite(d)) continue;
			haveLastContact += 1;
			if (d <= 7) contactedThisWeek += 1;
			else if (d >= 8 && d <= 14) contactedPrevWeek += 1;
		}

		if (haveLastContact === 0) {
			wowPercent = 0;
		} else if (contactedPrevWeek === 0) {
			wowPercent = contactedThisWeek > 0 ? 100 : 0;
		} else {
			wowPercent = Math.round(((contactedThisWeek - contactedPrevWeek) / contactedPrevWeek) * 100);
		}
	}

	if (wowPercent >= 10) label = 'Accelerating';
	else if (wowPercent <= -10) label = 'Slowing';
	else label = 'Stable';

	return { label, wowPercent };
};

const computeNextBestAction = ({ leads = [], insight }) => {
	const text = (insight?.topAction || '').trim() || 'Review pipeline and take action on the highest-risk deal.';
	const impact = insight?.revenueImpact || 'Unknown';

	// Choose the best matching deal:
	// 1) If priorities exist, take highest priority.
	// 2) Else, take the highest amount deal.
	const priorities = Array.isArray(insight?.priorities) ? insight.priorities : [];

	let pick = null;
	if (priorities.length) {
		const top = priorities[0];
		const matchId = top?.id;
		pick = (leads || []).find((l) => getLeadIdentifier(l) === matchId) || null;
		if (!pick) {
			// fallback to a name match if IDs differ between systems
			const topName = String(top?.name || '').toLowerCase();
			pick = (leads || []).find((l) => String(l?.name || '').toLowerCase() === topName) || null;
		}
	}

	if (!pick && Array.isArray(leads) && leads.length) {
		pick = [...leads]
			.sort((a, b) => clampNumber(normalizeAmount(b), 0) - clampNumber(normalizeAmount(a), 0))[0];
	}

	const deal = pick
		? {
			name: pick.name || pick.company || getLeadIdentifier(pick),
			amount: clampNumber(normalizeAmount(pick), 0),
			stage: pick.stage || null,
			lastContactDays: pick.daysSinceLastContact ?? daysSince(pick.lastContact),
		}
		: { name: 'Unknown', amount: 0, stage: null, lastContactDays: null };

	return { text, impact, deal };
};

const buildCopilotMetrics = ({ crmData, insight }) => {
	const leads = crmData?.leads || [];
	return {
		cashAtRisk: computeCashAtRisk({ leads, insight }),
		revenueVelocity: computeRevenueVelocity({ leads }),
		nextBestAction: computeNextBestAction({ leads, insight }),
	};
};

module.exports = {
	buildCopilotMetrics,
	computeCashAtRisk,
	computeRevenueVelocity,
	computeNextBestAction,
};
