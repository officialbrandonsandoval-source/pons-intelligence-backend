require('dotenv').config();
const express = require('express');

const rateLimiter = require('./middleware/rateLimiter');
const router = require('./flow/router');
const hubspotAuthRouter = require('./flow/hubspotAuth');
const { logRequest } = require('./utils/logger');
const voiceRouter = require('./flow/voiceRouter');

const app = express();

app.use(express.json());
app.use(rateLimiter);
app.use(logRequest);
app.use('/api', voiceRouter);
app.use('/api', hubspotAuthRouter);
app.use('/api', router);

// Fallback error handler to keep errors consistent
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	const status = err.status || 500;
	res.status(status).json({
		error: err.message || 'Internal Server Error',
	});
});

const port = process.env.PORT || 3000;

if (require.main === module) {
	app.listen(port);
}

module.exports = app;
