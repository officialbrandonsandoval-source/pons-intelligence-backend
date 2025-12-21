const levels = ['debug', 'info', 'warn', 'error'];

const formatMessage = (level, message, meta) => {
	const timestamp = new Date().toISOString();
	const metaString = meta ? ` | ${JSON.stringify(meta)}` : '';
	return `[${timestamp}] ${level.toUpperCase()} ${message}${metaString}`;
};

const logger = levels.reduce((acc, level) => {
	acc[level] = (message, meta) => {
		// eslint-disable-next-line no-console
		console[level === 'debug' ? 'log' : level](formatMessage(level, message, meta));
	};
	return acc;
}, {});

const logRequest = (req, res, next) => {
	const start = Date.now();
	res.on('finish', () => {
		const duration = Date.now() - start;
		logger.info(`${req.method} ${req.originalUrl}`, {
			status: res.statusCode,
			durationMs: duration,
		});
	});
	next();
};

const logError = (error, meta = {}) => {
	const message = error?.message || 'Unknown error';
	const stack = error?.stack;
	logger.error(message, { ...meta, stack });
};

module.exports = { logger, logRequest, logError };
