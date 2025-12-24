const express = require('express');
const { analyzeRevenue } = require('../ai/insightEngine');
const { validateCRMData } = require('../utils/validate');
const { logError } = require('../utils/logger');
const { getDeals } = require('../services/hubspot/deals');
const { getToken, isTokenExpired, storeGhlCredentials, getGhlCredentials } = require('../services/tokenStore');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'live', system: 'PONS Intelligence' });
});

// GoHighLevel connection endpoint.
// Kept intentionally simple: stores provided API key + location ID in-memory.
router.post('/auth/ghl', (req, res) => {
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

// GoHighLevel connection status.
// GET /api/auth/ghl/status?userId=...
router.get('/auth/ghl/status', (req, res) => {
  try {
    const userId = String(req.query?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const connected = Boolean(getGhlCredentials(userId));
    return res.json({ connected });
  } catch (err) {
    logError(err, { endpoint: '/auth/ghl/status' });
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

router.post('/command', async (req, res) => {
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

  if (source === 'gohighlevel') {
    const creds = getGhlCredentials(userId);
    if (!creds) {
      return res.status(409).json({ error: 'gohighlevel_not_connected' });
    }
    return res.status(400).json({ error: 'GoHighLevel deal fetch is not implemented yet in this backend' });
  }

    validateCRMData(crmData);

    // Back-compat bridge:
    // Existing connectors return { leads: [...] }. The new core brain expects { deals: [...] }.
    // Until all connectors emit normalized Deal objects directly, we map leads -> deals here.
    const deals = (crmData?.leads || []).map((l) => ({
      id: l.id || l.leadId || l.name,
      name: l.name,
      amount: l.amount,
      stage: l.stage,
      probability: l.probability,
      lastActivityAt: l.lastActivityAt || l.lastContact || l.closeDate || l.closedate,
      createdAt: l.createdAt,
      expectedCloseDate: l.expectedCloseDate || l.closeDate || l.closedate,
      owner: l.owner,
      source,
    }));

    const insight = await analyzeRevenue({ deals, now: new Date() });
    res.json({ insight });
  } catch (err) {
    logError(err, { endpoint: '/command' });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
