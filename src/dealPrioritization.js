// Minimal deterministic deal ranking placeholder.
// Returns [{ dealId, amount, recommendedAction, explanation }]

const toNumber = (n, fallback = 0) => {
	const x = Number(n);
	return Number.isFinite(x) ? x : fallback;
};

const rankDeals = (deals = [], _now = new Date()) => {
	const rows = (Array.isArray(deals) ? deals : []).map((d) => {
		const amount = toNumber(d?.amount, 0);
		const probability = toNumber(d?.probability, 0.5);
		const score = amount * probability;
		return {
			dealId: d?.id || d?.dealId || d?.name,
			amount,
			score,
			recommendedAction: 'book the next step',
			explanation: 'Ranked by expected value (amount * probability).',
		};
	});

	return rows.sort((a, b) => (b.score - a.score) || (b.amount - a.amount));
};

module.exports = { rankDeals };
