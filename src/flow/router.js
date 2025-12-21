const express = require('express');
const { authenticate } = require('../middleware/auth');
const { analyzeRevenue } = require('../ai/insightEngine');
const { validateCRMData } = require('../utils/validate');
const { logError } = require('../utils/logger');
const { getDeals } = require('../services/hubspot/deals');
const { getToken, isTokenExpired } = require('../services/tokenStore');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'live', system: 'PONS Intelligence' });
});

router.post('/command', authenticate, async (req, res) => {
  try {
    const { data, source, userId = 'dev' } = req.body;
    let crmData = data;

    if (source === 'hubspot') {
      const token = getToken(userId);
      if (!token) {
        return res.status(400).json({ error: 'HubSpot is not authorized. Start at /api/auth/hubspot' });
      }

      if (isTokenExpired(token)) {
        return res.status(401).json({ error: 'HubSpot token expired. Reconnect via /api/auth/hubspot' });
      }

      crmData = await getDeals(token);
    }

    validateCRMData(crmData);
    const insight = await analyzeRevenue(crmData);
    res.json({ insight });
  } catch (err) {
    logError(err, { endpoint: '/command' });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
