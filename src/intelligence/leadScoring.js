// Minimal deterministic scoring placeholder.
// Input: array of deals
// Output: array of deals with a stable score field

const toNumber = (n, fallback = 0) => {
	const x = Number(n);
	return Number.isFinite(x) ? x : fallback;
};

const scoreLeads = (deals = []) => {
	return (Array.isArray(deals) ? deals : []).map((d) => {
		const amount = toNumber(d?.amount, 0);
		const probability = toNumber(d?.probability, 0.5);
		// Simple deterministic score: expected value.
		const score = amount * probability;
		return { ...d, score };
	});
};

module.exports = { scoreLeads };
