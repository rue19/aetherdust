# AetherDust API Reference

## Base URL
```
http://localhost:3000
```

## Authentication

### API Key
All `/v1/sponsor`, `/v1/campaigns`, `/v1/transactions`, and `/v1/analytics` endpoints require an API key:
```
Authorization: Bearer ad_live_<your_key>
```

### Admin JWT
Admin endpoints (`/v1/admin/*`) require a JWT obtained via `/v1/admin/login`:
```
Authorization: Bearer <jwt_token>
```

---

## Public Endpoints

### `GET /health`
Health check. No authentication required.

**Response:**
```json
{ "status": "ok", "uptime": 123.45, "timestamp": "2026-09-12T..." }
```

### `POST /v1/sponsor`
Sponsor a DUST transaction.

**Request Body:**
```json
{
  "transactionHex": "aabbccdd...",
  "campaignId": "uuid",
  "contractAddress": "0x1234",
  "entryPoint": "checkin",
  "estimatedFeeSpeck": 100000000,
  "usageId": "user-123"
}
```

**Response (approved):**
```json
{
  "status": "approved",
  "transaction": "tx-hash-or-mock-id",
  "sponsorship": { "dust": "100000000" }
}
```

**Response (rejected):**
```json
{
  "status": "rejected",
  "reason": "CAMPAIGN_DISABLED"
}
```

**Rejection Reasons:**
| Reason | Description |
|--------|-------------|
| `INVALID_TRANSACTION` | Malformed transaction hex or missing fields |
| `CAMPAIGN_DISABLED` | Campaign is paused |
| `CAMPAIGN_EXPIRED` | Campaign end time has passed |
| `CAMPAIGN_NOT_STARTED` | Campaign start time hasn't arrived |
| `CONTRACT_NOT_ALLOWED` | Contract not in allowlist |
| `ENTRYPOINT_NOT_ALLOWED` | Entry point not in allowlist |
| `FEE_TOO_HIGH` | Fee exceeds per-tx limit |
| `BUDGET_EXCEEDED` | Daily budget exhausted |
| `USER_LIMIT_EXCEEDED` | Per-user tx count limit hit |

---

## Campaign Endpoints (require `sponsor` or `campaigns:read` scope)

### `GET /v1/campaigns`
List all campaigns for the API key's project.

### `GET /v1/campaigns/:id`
Get a single campaign.

### `POST /v1/campaigns`
Create a campaign.
```json
{
  "name": "Summer Promo",
  "dailyBudgetSpeck": "50000000000000",
  "perTxLimitSpeck": "1000000000000",
  "perUserTxLimit": 10,
  "epochDurationSeconds": 86400,
  "allowedContracts": ["0x1234"],
  "allowedEntryPoints": ["checkin"],
  "startTime": "2026-01-01T00:00:00Z"
}
```

### `PUT /v1/campaigns/:id`
Update a campaign. Partial updates supported.

### `PATCH /v1/campaigns/:id/toggle`
Toggle campaign enabled/disabled.

### `DELETE /v1/campaigns/:id`
Delete a campaign.

---

## Transaction Endpoints (require `sponsor` scope)

### `GET /v1/transactions`
List transactions. Query params: `campaignId`, `status`, `limit`, `offset`.

### `GET /v1/transactions/:id`
Get a single transaction.

---

## Analytics Endpoints (require `analytics:read` scope)

### `GET /v1/analytics/overview`
Project-level overview: total campaigns, enabled count, total daily spend.

### `GET /v1/analytics/campaigns/:id`
Campaign-level daily spend for last N days. Query param: `days` (default 30).

---

## Admin Endpoints (require JWT)

### `POST /v1/admin/login`
```json
{ "email": "admin@aetherdust.local", "password": "changeme" }
```
**Response:** `{ "token": "jwt...", "user": { ... } }`

### `GET /v1/admin/api-keys?projectId=<uuid>`
List API keys for a project.

### `POST /v1/admin/api-keys`
```json
{ "projectId": "uuid", "name": "Production Key", "scopes": ["sponsor"] }
```
**Response includes `plaintextKey` — shown only once.**

### `DELETE /v1/admin/api-keys/:id`
Revoke an API key.

### `GET /v1/admin/audit-log?limit=50`
List audit log entries.
