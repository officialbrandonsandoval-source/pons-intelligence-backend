# Pons Intelligence API

An Express-based API for generating CRM revenue insights with Anthropic and optional HubSpot read-only integration.

## Features
- API key authentication (`x-api-key` header)
- Rate limiting via `express-rate-limit`
- Request logging
- `/api/command` endpoint that accepts CRM context and generates a revenue insight
- Optional HubSpot OAuth flow (`/api/auth/hubspot`) with in-memory token store and deal ingestion
- Health check at `/api/health`

## Quick start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template and set values:
   ```bash
   cp .env.example .env
   ```
3. Run the server:
   ```bash
   npm start
   ```

Default server listens on `PORT` (3000 if unset).

## Environment variables
See `.env.example` for all keys.

## API
### `GET /api/health`
Returns `{ status: "live", system: "PONS Intelligence" }`.

### `GET /api/auth/hubspot`
Starts HubSpot OAuth. Requires `x-api-key` header. Redirects to HubSpot; callback handled at `/api/auth/hubspot/callback`.

### `POST /api/command`
Headers: `x-api-key: <API_KEY>`

Body (manual data):
```
{
   "data": {
      "leads": [
         { "name": "Acme", "amount": 50000, "stage": "contract" }
      ]
   }
}
```

Body (pull from HubSpot deals):
```
{
   "source": "hubspot",
   "userId": "dev" // optional; defaults to "dev"
}
```

Returns `{ insight }`.


## Notes
- Anthropic calls require `ANTHROPIC_API_KEY`.
- HubSpot integration is read-only; tokens are stored in-memory and cleared on server restart.
