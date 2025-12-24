/*
Auth behavior smoke test (no external deps)

Contract:
- Demo allowlisted routes should work WITHOUT x-api-key:
  - GET /api/health
  - POST /api/voice/session/start
  - POST /api/copilot

- Protected route behavior:
  - If x-api-key header is missing -> 401
  - If x-api-key header is present but invalid -> 403

Note: This test assumes the API key middleware is mounted in a way that actually protects at least
one route. It will call /api/insights as a representative protected endpoint.
*/

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const startServer = async () => {
  const app = require('../src/index');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
};

const postJson = async (url, body, headers = {}) => {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
};

(async () => {
  // Ensure we have a known expected key for tests.
  // This is only for the test process; it doesn't modify repo files.
  process.env.API_KEY = process.env.API_KEY || 'test_api_key';

  const { server, baseUrl } = await startServer();

  try {
    // Demo allowlisted routes: no x-api-key
    {
      const r = await fetch(`${baseUrl}/api/health`);
      assert(r.status === 200, `GET /api/health expected 200, got ${r.status}`);
      const j = await r.json();
      assert(j && j.status === 'ok', `GET /api/health expected {status:'ok'}, got ${JSON.stringify(j)}`);
    }

    // Voice routes are protected (not allowlisted): validate that auth enforcement is working.
    {
      const r = await postJson(`${baseUrl}/api/voice/session/start`, { userId: 'demo' });
      assert(r.status === 401, `POST /api/voice/session/start expected 401 (missing key), got ${r.status}`);
    }

    {
      const r = await postJson(`${baseUrl}/api/copilot`, { query: 'Hello' });
      assert(r.status === 200, `POST /api/copilot expected 200, got ${r.status}`);
      const j = await r.json();
      assert(j && typeof j.answer === 'string', 'copilot expected answer string');
      assert(j && j.structured && typeof j.structured === 'object', 'copilot expected structured object');
    }

    // Protected route checks (using /api/insights)
    {
      const r = await postJson(`${baseUrl}/api/insights`, { deals: [] });
      assert(r.status === 401, `POST /api/insights w/o key expected 401, got ${r.status}`);
    }

    {
      const r = await postJson(
        `${baseUrl}/api/insights`,
        { deals: [] },
        { 'x-api-key': 'wrong_key' }
      );
      assert(r.status === 403, `POST /api/insights w/ wrong key expected 403, got ${r.status}`);
    }

    {
      const r = await postJson(
        `${baseUrl}/api/insights`,
        { deals: [] },
        { 'x-api-key': process.env.API_KEY }
      );
      // /api/insights can be 200 or 400 depending on input validation, but must not be 401/403.
      assert(r.status !== 401 && r.status !== 403, `POST /api/insights w/ correct key expected not 401/403, got ${r.status}`);
    }

    // Additional protected route coverage (POST /api/intelligence/analyze)
    // This endpoint is protected in src/flow/intelligenceRouter.js.
    {
      const r = await postJson(`${baseUrl}/api/intelligence/analyze`, { source: 'hubspot', userId: 'dev' });
      assert(
        r.status === 401,
        `POST /api/intelligence/analyze w/o key expected 401, got ${r.status}`
      );
    }

    {
      const r = await postJson(
        `${baseUrl}/api/intelligence/analyze`,
        { source: 'hubspot', userId: 'dev' },
        { 'x-api-key': 'wrong_key' }
      );
      assert(
        r.status === 403,
        `POST /api/intelligence/analyze w/ wrong key expected 403, got ${r.status}`
      );
    }

    {
      const r = await postJson(
        `${baseUrl}/api/intelligence/analyze`,
        { source: 'hubspot', userId: 'dev' },
        { 'x-api-key': process.env.API_KEY }
      );
      // With a valid key, this call will likely return 400 (hubspot not authorized) but must not be 401/403.
      assert(
        r.status !== 401 && r.status !== 403,
        `POST /api/intelligence/analyze w/ correct key expected not 401/403, got ${r.status}`
      );
    }

    console.log('auth.smoke: PASS');
    process.exitCode = 0;
  } catch (err) {
    console.error('auth.smoke: FAIL');
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
})();
