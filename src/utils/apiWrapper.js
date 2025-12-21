const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const callWithRetry = async (fn, { retries = 3, baseDelayMs = 200 } = {}) => {
	let attempt = 0;
	let lastError;
	while (attempt <= retries) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (attempt === retries) break;
			const delay = baseDelayMs * 2 ** attempt;
			await sleep(delay);
		}
		attempt += 1;
	}
	throw lastError;
};

const wrapAsync = (fn) => (req, res, next) => {
	Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { wrapAsync, callWithRetry };
