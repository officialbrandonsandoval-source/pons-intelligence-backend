const express = require('express');
const { authenticate } = require('../middleware/auth');
const { analyzeRevenue } = require('../ai/insightEngine');
const { validateCRMData } = require('../utils/validate');
const { logError } = require('../utils/logger');
const { getDeals } = require('../services/hubspot/deals');
const { getToken, isTokenExpired, storeGhlCredentials } = require('../services/tokenStore');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'live', system: 'PONS Intelligence' });
});

// GoHighLevel connection endpoint.
// Kept intentionally simple: stores provided API key + location ID in-memory.
router.post('/auth/ghl', authenticate, (req, res) => {
  try {
    const { userId, apiKey, locationId } = req.body || {};
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ error: 'apiKey is required' });
    }
    if (!locationId || typeof locationId !== 'string' || !locationId.trim()) {
      return res.status(400).json({ error: 'locationId is required' });
    }

    storeGhlCredentials(userId.trim(), { apiKey, locationId });
    return res.json({ success: true });
  } catch (err) {
    logError(err, { endpoint: '/auth/ghl' });
    return res.status(400).json({ error: err.message || 'Failed to store GHL credentials' });
  }
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
