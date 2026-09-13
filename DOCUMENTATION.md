# AetherDust — Application Documentation

## Table of Contents
1. [What is AetherDust](#what-is-aetherdust)
2. [Architecture Overview](#architecture-overview)
3. [How the Sponsor Flow Works](#how-the-sponsor-flow-works)
4. [Database Schema](#database-schema)
5. [Backend API Routes](#backend-api-routes)
6. [Dashboard Pages — Full Walkthrough](#dashboard-pages)
7. [Authentication & Security](#authentication--security)
8. [Current Demo State](#current-demo-state)
9. [How to Run](#how-to-run)
10. [Future Improvements](#future-improvements)

---

## What is AetherDust

AetherDust is an open-source, self-hostable **DUST sponsorship infrastructure** for the Midnight blockchain. It lets DApp developers sponsor transaction fees (in DUST tokens) on behalf of their users, removing the barrier of needing DUST to interact with a DApp.

**Key value proposition:** Users interact with your DApp without needing tokens. Your server pays the transaction fees, with full budget controls, per-user limits, and audit trails.

**Example use case:** A game DApp wants to let new players check in daily without needing a wallet. The game operator creates a campaign that allows 10 check-in transactions per user per day, with a total daily budget of 50,000 DUST. AetherDust validates each request against the campaign rules and submits it to the Midnight network.

---

## Architecture Overview

```
┌──────────────┐     ┌─────────────────────────────────────────────────┐
│  Dashboard   │────▶│  Fastify API Server (port 3000)                 │
│  (Vite/React)│     │                                                 │
│  port 5173   │     │  ┌─────────────┐  ┌──────────────┐  ┌────────┐ │
└──────────────┘     │  │  Admin JWT  │  │  API Key     │  │  Rate  │ │
                     │  │  Auth       │  │  Auth        │  │  Limit │ │
                     │  └──────┬──────┘  └──────┬───────┘  └────────┘ │
                     │         │                │                      │
                     │  ┌──────▼──────┐  ┌──────▼───────┐  ┌────────┐ │
                     │  │  Admin      │  │  Sponsor     │  │Metrics │ │
                     │  │  Routes     │  │  Endpoint    │  │Plugin  │ │
                     │  └──────┬──────┘  └──────┬───────┘  └────────┘ │
                     │         │                │                      │
                     │  ┌──────▼────────────────▼───────┐              │
                     │  │     Policy Engine              │              │
                     │  │  (campaign validation)         │              │
                     │  └──────────────┬────────────────┘              │
                     │                 │                               │
                     │  ┌──────────────▼────────────────┐              │
                     │  │     Preflight Checks           │              │
                     │  │  (budget, rate, circuit breaker)│             │
                     │  └──────────────┬────────────────┘              │
                     │                 │                               │
                     │  ┌──────────────▼────────────────┐              │
                     │  │     Sponsor Module              │              │
                     │  │  (sign + submit to Midnight)   │              │
                     │  └──────────────┬────────────────┘              │
                     │                 │                               │
                     │  ┌──────────────▼────────────────┐              │
                     │  │     Midnight Wallet Provider    │              │
                     │  │  (real or mock in dev)         │              │
                     │  └──────────────┬────────────────┘              │
                     └─────────────────┼───────────────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  Midnight Network │
                              │  (or mock in dev) │
                              └─────────────────┘
```

### Packages

| Package | Purpose |
|---------|---------|
| `api` | Fastify REST server — all HTTP endpoints |
| `dashboard` | React + Vite + Tailwind admin UI |
| `database` | Drizzle ORM schema, migrations, repository functions |
| `policy-engine` | Campaign rule evaluation (budget, per-user, contract whitelist) |
| `preflight` | Pre-submission validation pipeline + circuit breaker logic |
| `sponsor` | Transaction signing and submission to Midnight |
| `midnight` | `AetherDustWalletProvider` wrapper around Midnight SDK |
| `privacy-limits` | Nullifier-based privacy rate limiting (stub/placeholder) |
| `demo-dapp` | Counter contract + React frontend for testing |

---

## How the Sponsor Flow Works

This is the core product. When a DApp user performs an action that requires a blockchain transaction, the DApp sends it to AetherDust instead of asking the user to pay.

### Request lifecycle (`POST /v1/sponsor`)

```
DApp                          AetherDust                      Midnight
 │                               │                               │
 │  POST /v1/sponsor             │                               │
 │  { transactionHex,            │                               │
 │    campaignId,                 │                               │
 │    contractAddress,            │                               │
 │    entryPoint,                 │                               │
 │    estimatedFeeSpeck }         │                               │
 │──────────────────────────────▶│                               │
 │                               │  1. Verify API key + scope    │
 │                               │  2. Load campaign by ID       │
 │                               │  3. Create transaction record │
 │                               │  4. Run preflight checks:     │
 │                               │     - Campaign enabled?       │
 │                               │     - Contract allowed?       │
 │                               │     - Entry point allowed?    │
 │                               │     - Per-user limit ok?      │
 │                               │     - Daily budget ok?        │
 │                               │     - Circuit breaker ok?     │
 │                               │  5. If any check fails:       │
 │                               │     return { rejected, reason }│
 │                               │  6. Sponsor + submit tx       │
 │                               │──────────────────────────────▶│
 │                               │                               │
 │                               │◀──────────────────────────────│
 │                               │  txId                         │
 │  { status: 'approved',        │                               │
 │    transaction: txId }         │                               │
 │◀──────────────────────────────│                               │
 │                               │                               │
```

### Preflight checks in detail

| Check | What it validates |
|-------|-------------------|
| **Campaign enabled** | `campaign.enabled === true` |
| **Time window** | Current time is between `startTime` and `endTime` (if set) |
| **Contract whitelist** | `contractAddress` is in `campaign.allowedContracts` (empty = allow all) |
| **Entry point whitelist** | `entryPoint` is in `campaign.allowedEntryPoints` (empty = allow all) |
| **Per-tx limit** | `estimatedFeeSpeck <= campaign.perTxLimitSpeck` |
| **Per-user limit** | User hasn't exceeded `campaign.perUserTxLimit` in the current epoch |
| **Daily budget** | Total spend today < `campaign.dailyBudgetSpeck` |
| **Circuit breaker** | Spend within rolling window < `cbMaxSpeck` |

### Circuit breaker

The circuit breaker is an automatic safety mechanism. If a campaign's spending within a rolling window (default 60 seconds) exceeds `cbMaxSpeck` (default 40 trillion SPECK), the circuit "trips" and the campaign is auto-paused. This prevents runaway spending if, for example, a bug causes repeated sponsorship requests.

```typescript
// packages/api/src/circuit-breaker-store.ts
interface CircuitBreakerState {
  windowStart: Date;        // When the current window started
  spentInWindowSpeck: bigint; // Total spent in this window
  tripped: boolean;         // Whether the breaker has tripped
}
```

The breaker resets when the window expires and new requests come in.

---

## Database Schema

### Tables

#### `projects`
Top-level grouping. A project owns campaigns, API keys, and has an owner (admin user).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | text | Project name |
| `owner_id` | UUID | FK to admin_users |
| `created_at` | timestamptz | Creation time |

#### `campaigns`
Sponsorship rules — the core business entity.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `project_id` | UUID | FK to projects |
| `name` | text | Campaign name |
| `enabled` | boolean | Whether campaign is active |
| `daily_budget_speck` | numeric(39) | Max DUST spend per day |
| `per_tx_limit_speck` | numeric(39) | Max fee per single transaction |
| `per_user_tx_limit` | integer | Max transactions per user per epoch |
| `epoch_duration_seconds` | integer | Length of one epoch (for per-user reset) |
| `allowed_contracts` | text[] | Whitelist of contract addresses (empty = all) |
| `allowed_entry_points` | text[] | Whitelist of entry points (empty = all) |
| `start_time` | timestamptz | When campaign becomes active |
| `end_time` | timestamptz | When campaign expires (null = never) |
| `cb_window_seconds` | integer | Circuit breaker window size |
| `cb_max_speck` | numeric(39) | Circuit breaker spend threshold |
| `created_at` | timestamptz | Creation time |
| `updated_at` | timestamptz | Last modification time |

#### `transactions`
Every sponsorship request, whether approved or rejected.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `status` | enum | `pending`, `sponsored`, `rejected`, `failed` |
| `rejection_reason` | text | Why it was rejected |
| `tx_hash` | text | Midnight transaction hash (if sponsored) |
| `transaction_hex` | text | The original unsigned tx hex |
| `dust_fee_speck` | numeric(39) | Fee that was sponsored |
| `contract_address` | text | Target contract |
| `entry_point` | text | Target entry point |
| `usage_id` | text | DApp-provided deduplication ID |
| `ip_address` | inet | Requester IP |
| `user_agent` | text | Requester user agent |
| `requested_at` | timestamptz | When request was received |
| `processed_at` | timestamptz | When it was finalized |

#### `usage_ledger`
Fee spend records — used for daily budget calculations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `usage_id` | text | DApp-provided dedup ID |
| `fee_speck` | numeric(39) | Fee amount |
| `recorded_at` | timestamptz | When recorded |

#### `api_keys`
Per-project authentication keys with scoped permissions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `project_id` | UUID | FK to projects |
| `key_hash` | text | SHA-256 hash of the key |
| `key_prefix` | text | First 8 chars (for display) |
| `name` | text | Human-readable name |
| `scopes` | text[] | e.g., `['sponsor', 'campaigns:read']` |
| `rate_limit_rps` | integer | Per-key rate limit |
| `enabled` | boolean | Active or revoked |
| `last_used_at` | timestamptz | Last usage time |
| `created_at` | timestamptz | Creation time |
| `expires_at` | timestamptz | Optional expiry |

#### `admin_users`
Dashboard login accounts.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `email` | text | Unique login email |
| `password_hash` | text | bcryptjs hash |
| `name` | text | Display name |
| `role` | enum | `admin` or `viewer` |
| `created_at` | timestamptz | Creation time |
| `last_login_at` | timestamptz | Last login time |

#### `audit_log`
Immutable audit trail of all administrative and system actions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `actor_id` | UUID | Who performed the action |
| `actor_type` | enum | `admin`, `api_key`, or `system` |
| `action` | text | e.g., `campaign.create`, `sponsor.approved` |
| `target_type` | text | e.g., `campaign`, `api_key` |
| `target_id` | text | ID of the affected resource |
| `metadata` | jsonb | Additional context |
| `created_at` | timestamptz | When it happened |

---

## Backend API Routes

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server status, uptime, timestamp |
| `GET` | `/metrics` | Prometheus-format metrics (counters, histograms, gauges) |

### API-Key Authenticated (`/v1/...`)

These are used by DApps and external integrations. Requires `Authorization: Bearer <api_key>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/sponsor` | **Core endpoint** — submit a transaction for sponsorship |
| `GET` | `/v1/campaigns` | List campaigns for the API key's project |
| `GET` | `/v1/campaigns/:id` | Get campaign details |
| `POST` | `/v1/campaigns` | Create a campaign (scope: `campaigns:write`) |
| `PUT` | `/v1/campaigns/:id` | Update a campaign |
| `PATCH` | `/v1/campaigns/:id/toggle` | Enable/disable a campaign |
| `DELETE` | `/v1/campaigns/:id` | Delete a campaign |
| `GET` | `/v1/transactions` | List transactions (scope: `sponsor`) |
| `GET` | `/v1/transactions/:id` | Get transaction details |
| `GET` | `/v1/analytics/overview` | Project-level analytics |
| `GET` | `/v1/analytics/campaigns/:id` | Campaign-level analytics |

### Admin JWT Authenticated (`/v1/admin/...`)

These are used by the dashboard. Requires `Authorization: Bearer <jwt_token>`.

| Method | Path | Description | Role Required |
|--------|------|-------------|---------------|
| `POST` | `/v1/admin/login` | Login, returns JWT | None (public) |
| `GET` | `/v1/admin/overview` | Dashboard summary stats | Any |
| `GET` | `/v1/admin/projects` | List projects | Any |
| `POST` | `/v1/admin/projects` | Create project | admin |
| `GET` | `/v1/admin/campaigns` | List campaigns | Any |
| `GET` | `/v1/admin/campaigns/:id` | Campaign detail | Any |
| `POST` | `/v1/admin/campaigns` | Create campaign | admin |
| `PUT` | `/v1/admin/campaigns/:id` | Update campaign | admin |
| `PATCH` | `/v1/admin/campaigns/:id/toggle` | Toggle campaign | Any |
| `DELETE` | `/v1/admin/campaigns/:id` | Delete campaign | admin |
| `GET` | `/v1/admin/campaigns/:id/analytics` | Campaign analytics | Any |
| `GET` | `/v1/admin/transactions` | List transactions | Any |
| `GET` | `/v1/admin/transactions/:id` | Transaction detail | Any |
| `GET` | `/v1/admin/users` | List admin users | admin |
| `POST` | `/v1/admin/users` | Create admin user | admin |
| `DELETE` | `/v1/admin/users/:id` | Delete admin user | admin |
| `GET` | `/v1/admin/api-keys` | List API keys | Any |
| `POST` | `/v1/admin/api-keys` | Create API key | admin |
| `DELETE` | `/v1/admin/api-keys/:id` | Revoke API key | admin |
| `GET` | `/v1/admin/audit-log` | View audit log | Any |
| `GET` | `/v1/admin/wallet/balance` | Sponsor wallet balance | Any |

### Middleware Stack (applied in order)

1. **Input Sanitization** — Blocks XSS patterns (`<script>`, `javascript:`, `on*=`) and template injection (`${...}`, `{{...}}`)
2. **Rate Limiting** — Per-project sliding window, configurable RPS
3. **Authentication** — API key (scopes) or JWT (roles)
4. **Metrics** — Every request logged as counter + duration histogram
5. **CORS** — Configurable origins via `CORS_ORIGINS` env var

---

## Dashboard Pages

### Login (`/login`)

A centered form with email and password fields. On successful login:
- JWT token stored in `localStorage`
- User object (id, email, name, role) stored in `localStorage`
- Redirects to `/` (campaigns page)

All other routes are protected — if no token exists, the user is redirected to `/login`.

**Default credentials:** `admin@aetherdust.local` / `changeme`

---

### Campaigns (`/` and `/campaigns`)

The landing page and primary management view.

**Top section — Overview cards:**
- Total Campaigns count
- Enabled Campaigns count
- Total Daily Spend (SPECK) across all campaigns

**Main section — Campaign table:**
| Column | Content |
|--------|---------|
| Name | Campaign name |
| Status | Green "Enabled" or red "Disabled" badge |
| Budget / Day | Daily budget in SPECK |
| Per-Tx Limit | Maximum fee per transaction |
| Actions | "Details" link to campaign detail page |

**Create button** (top right) opens a modal overlay with fields:
- Name
- Daily Budget (SPECK)
- Per-Tx Limit (SPECK)
- Per-User Tx Limit
- Epoch Duration (seconds)
- Allowed Contracts (comma-separated addresses)
- Allowed Entry Points (comma-separated)

On submit, `POST /v1/admin/campaigns` is called. The modal closes and the table refreshes.

---

### Campaign Detail (`/campaigns/:id`)

Shows full campaign configuration and analytics.

**Header:**
- Campaign name + status badge
- Enable/Disable toggle button
- Edit button — toggles an inline form with all campaign fields
- Delete button — confirms, then calls `DELETE /v1/admin/campaigns/:id` and redirects to `/campaigns`

**Left panel — Configuration:**
| Field | Value |
|-------|-------|
| Daily Budget | e.g., `50000000000000 SPECK` |
| Per-Tx Limit | e.g., `1000000000000 SPECK` |
| Per-User Limit | e.g., `10` |
| Epoch Duration | e.g., `86400s` |
| Allowed Contracts | e.g., `0x1234` |
| Allowed Entry Points | e.g., `checkin` |

**Right panel — Daily Spend (30 days):**
Lists the last 10 days with date, total SPECK spent, and transaction count. If no data exists, shows "No spend data yet".

---

### Transactions (`/transactions`)

Filterable list of all sponsorship requests.

**Filter buttons:** All | sponsored | rejected | pending | failed

**Table columns:**
| Column | Content |
|--------|---------|
| Status | Colored badge (green/red/yellow/gray) |
| Campaign | Truncated campaign ID |
| Fee (SPECK) | DUST fee that was/would be sponsored |
| Contract | Contract address (or `-`) |
| Entry Point | Entry point name (or `-`) |
| Requested | Timestamp of the request |
| Actions | "Detail" link to transaction detail page |

---

### Transaction Detail (`/transactions/:id`)

Full information about a single sponsorship request.

**Left panel — Status:**
- Status badge + rejection reason (if rejected)
- Transaction ID (UUID)
- TX Hash (Midnight blockchain hash, or "Pending")
- Fee (SPECK)
- Campaign ID

**Right panel — Details:**
- Contract address
- Entry point
- Usage ID (deduplication key from DApp)
- IP address of requester
- User agent of requester
- Requested at (timestamp)
- Processed at (timestamp)

---

### Projects (`/projects`)

Manage top-level project groupings.

**Create form:** Inline input + "Create" button at the top.

**Table columns:**
| Column | Content |
|--------|---------|
| Name | Project name |
| Project ID | UUID |
| Created | Creation date |

---

### Admin Users (`/admin-users`)

Manage dashboard login accounts.

**"Add User" button** opens a modal with:
- Email
- Password
- Name
- Role (dropdown: Viewer / Admin)

**Table columns:**
| Column | Content |
|--------|---------|
| Email | User email |
| Name | Display name (or `-`) |
| Role | Blue "admin" or gray "viewer" badge |
| Last Login | Date or "Never" |
| Actions | "Delete" button (confirms before deleting) |

Self-deletion is prevented server-side.

---

### API Keys (`/api-keys`)

Manage per-project API keys for DApp integration.

**Table columns:**
| Column | Content |
|--------|---------|
| Name | Key name |
| Prefix | First 8 characters of the key |
| Scopes | List of granted scopes |
| Status | Enabled/disabled badge |
| Created | Creation date |
| Actions | "Revoke" button |

New keys are shown in full only once at creation time.

---

### Audit Log (`/audit-log`)

Immutable trail of all administrative and system actions.

**Table columns:**
| Column | Content |
|--------|---------|
| Action | e.g., `admin.login`, `campaign.create`, `sponsor.approved` |
| Actor | Who performed the action |
| Target | What was affected |
| Metadata | Additional context (JSON) |
| Timestamp | When it happened |

---

### Health (`/health`)

**Left panel — Server:**
| Field | Value |
|-------|-------|
| Status | Green "ok" or red error |
| Uptime | Seconds since server start |
| Timestamp | Current server time |

**Right panel — Sponsor Wallet:**
| Field | Value |
|-------|-------|
| Connected | Yes/No (green/red) |
| DUST Balance | Current balance |
| Address | Wallet address (truncated) |

In the current demo, the wallet is in mock mode since no Midnight network credentials are configured.

---

## Authentication & Security

### Two auth systems

1. **API Key Auth** (`/v1/...` routes) — Used by DApps
   - Keys are SHA-256 hashed in the database
   - Scoped: `sponsor`, `campaigns:read`, `campaigns:write`, `analytics:read`
   - Rate limited per-key

2. **JWT Auth** (`/v1/admin/...` routes) — Used by the dashboard
   - Tokens expire after 24 hours
   - Roles: `admin` (full access), `viewer` (read-only)
   - Passwords hashed with bcryptjs (12 rounds)

### Security measures

| Layer | Implementation |
|-------|---------------|
| Password hashing | bcryptjs, 12 rounds (legacy SHA-256 auto-re-hashed on login) |
| API key storage | SHA-256 hashed, only prefix stored in plaintext |
| JWT | 24h expiry, configurable secret |
| Rate limiting | Per-project sliding window (configurable RPS) |
| Input sanitization | XSS + template injection blocking |
| RBAC | Role-based access control on all admin endpoints |
| Audit logging | Every action logged with actor, target, metadata |
| Circuit breaker | Auto-pauses campaigns on runaway spending |
| CORS | Configurable allowed origins |
| Dev wallet fallback | Mock wallet gated behind `NODE_ENV=development` |

---

## Current Demo State

### What's running

- **PostgreSQL** — Docker container on port 5432
- **API Server** — Fastify on port 3000
- **Dashboard** — Vite dev server on port 5173 (proxies `/v1` and `/health` to port 3000)

### Seed data

After running `packages/database/src/seed.ts`:

| Resource | Name | Details |
|----------|------|---------|
| Admin User | `admin@aetherdust.local` | Password: `changeme`, Role: `admin` |
| Project | Demo Project | Owned by admin user |
| Campaign | Demo Campaign | 50T daily budget, 1T per-tx limit, 10 per-user, contracts: `0x1234`, entry points: `checkin` |
| API Key | Demo API Key | Scopes: `sponsor`, `campaigns:read` |

### Mock mode

Since no `SPONSOR_WALLET_SEED` or `MIDNIGHT_NETWORK_ENDPOINT` env vars are set:
- Mock wallet is used (fake 1M DUST balance)
- Sponsor endpoint falls back to mock transaction IDs in development mode
- All other functionality (campaigns, admin, audit, etc.) works with real Postgres

---

## How to Run

### Prerequisites
- Node.js >= 22
- Docker (for PostgreSQL)
- npm

### Steps

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Create .env for the API
cat > packages/api/.env << 'EOF'
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info
DATABASE_URL=postgresql://aetherdust:changeme@localhost:5432/aetherdust
JWT_SECRET=super-secret-change-me-in-production
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_RPS=100
RATE_LIMIT_WINDOW_MS=1000
EOF

# 3. Push schema to database
cd packages/database
DATABASE_URL=postgresql://aetherdust:changeme@localhost:5432/aetherdust npx drizzle-kit push

# 4. Seed the database
DATABASE_URL=postgresql://aetherdust:changeme@localhost:5432/aetherdust npx tsx src/seed.ts

# 5. Start the API server
cd packages/api
npx tsx src/main.ts

# 6. Start the dashboard (in a separate terminal)
cd packages/dashboard
npx vite --host 0.0.0.0 --port 5173
```

### Docker (production)

```bash
docker compose up -d
```

This starts PostgreSQL, API, and dashboard with the Nginx production build.

---

## Future Improvements

### High Priority

1. **Real Midnight Network Integration**
   - Configure `SPONSOR_WALLET_SEED` and `MIDNIGHT_NETWORK_ENDPOINT` for production use
   - Test end-to-end sponsorship flow with real transactions
   - Add wallet balance monitoring and alerting when low

2. **Database Migrations**
   - Replace `drizzle-kit push` with proper migration files
   - Add migration versioning and rollback support
   - Run migrations automatically on API startup

3. **Session Management**
   - Add refresh token rotation (currently 24h JWT with no refresh)
   - Add token revocation / blacklist
   - Session invalidation on password change

4. **Email Verification & Password Reset**
   - Email verification flow for new admin users
   - Password reset via email with secure tokens
   - Account lockout after N failed login attempts

### Medium Priority

5. **Enhanced Dashboard UX**
   - Real-time campaign spend updates (WebSocket or polling)
   - Interactive charts (Recharts is already a dependency but not used)
   - Bulk operations (enable/disable multiple campaigns)
   - Campaign cloning
   - CSV/JSON export for transactions and audit log

6. **Advanced Analytics**
   - Per-user usage breakdown
   - Contract/entry-point level analytics
   - Cost forecasting based on historical trends
   - Anomaly detection (sudden spend spikes)

7. **Notification System**
   - Email alerts when campaign budget hits 80%/100%
   - Webhook notifications for sponsored/rejected transactions
   - Slack/Discord integration for team alerts

8. **Multi-tenancy**
   - Project-level isolation (currently projects exist but data isn't fully isolated)
   - Per-project billing and usage quotas
   - Team management with project-level roles

9. **API Key Improvements**
   - Key rotation without downtime (grace period for old keys)
   - Per-key spending limits
   - Key usage analytics dashboard

### Low Priority

10. **Privacy Limits (Nullifier Contract)**
    - Complete the `privacy-limits` package
    - Implement nullifier-based per-user rate limiting at the contract level
    - Integration with the policy engine

11. **Demo DApp Enhancements**
    - More complex demo contracts (voting, marketplace)
    - Wallet connection UI
    - Real-time transaction status tracking

12. **Observability**
    - Structured logging with request correlation IDs
    - Distributed tracing (OpenTelemetry)
    - Grafana dashboards for metrics
    - Alerting rules for error rates and latency

13. **Developer Experience**
    - SDK/client library for DApp integration (TypeScript, Python)
    - OpenAPI/Swagger documentation
    - Integration test suite with testkit-js
    - Load testing scripts

14. **Infrastructure**
    - Kubernetes deployment manifests
    - Terraform/IaC for cloud deployment
    - CI/CD pipeline extensions for staging/production
    - Backup and disaster recovery procedures
    - Horizontal scaling for the API server

15. **Security Hardening**
    - Penetration testing
    - Dependency vulnerability scanning (npm audit, Snyk)
    - Rate limiting per-IP (currently per-project only)
    - Request size limits and body validation
    - SQL injection prevention audit (Drizzle ORM handles this, but verify)

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `HOST` | `0.0.0.0` | API server host |
| `NODE_ENV` | `development` | Environment mode |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `DATABASE_URL` | `postgresql://aetherdust:changeme@localhost:5432/aetherdust` | Postgres connection string |
| `JWT_SECRET` | `changeme-set-JWT_SECRET-in-production` | JWT signing secret |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `RATE_LIMIT_RPS` | `10` | Default rate limit (requests per second) |
| `RATE_LIMIT_WINDOW_MS` | `1000` | Rate limit window size |
| `SPONSOR_WALLET_SEED` | _(none)_ | Midnight wallet seed (triggers real wallet mode) |
| `MIDNIGHT_NETWORK_ENDPOINT` | _(none)_ | Midnight network node URL |
| `MIDNIGHT_NETWORK_ID` | `undeployed` | Midnight network ID |
| `MIDNIGHT_NODE_WS_ENDPOINT` | _(derived)_ | WebSocket endpoint for Midnight node |
| `MIDNIGHT_INDEXER_ENDPOINT` | _(derived)_ | Midnight indexer URL |
| `MIDNIGHT_INDEXER_WS_ENDPOINT` | _(derived)_ | Midnight indexer WebSocket URL |
| `MIDNIGHT_PROOF_SERVER` | `http://127.0.0.1:6300` | Midnight proof server URL |
| `MIDNIGHT_FAUCET` | _(none)_ | Midnight faucet URL |
| `METRICS_API_KEY` | _(none)_ | Optional key to protect `/metrics` endpoint |

---

## API Response Examples

### Successful login
```json
POST /v1/admin/login
{
  "email": "admin@aetherdust.local",
  "password": "changeme"
}

Response 200:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "a7abe334-...",
    "email": "admin@aetherdust.local",
    "name": "Admin",
    "role": "admin"
  }
}
```

### Sponsor request (approved)
```json
POST /v1/sponsor
Headers: { "Authorization": "Bearer <api_key>" }
Body: {
  "campaignId": "e3739397-...",
  "transactionHex": "0x...",
  "contractAddress": "0x1234",
  "entryPoint": "checkin",
  "estimatedFeeSpeck": "1000000000000",
  "usageId": "user-123-checkin-2026-09-13"
}

Response 200:
{
  "status": "approved",
  "transaction": "mock-tx-abc123-def456",
  "sponsorship": { "dust": "1000000000000" }
}
```

### Sponsor request (rejected)
```json
Response 200:
{
  "status": "rejected",
  "reason": "DAILY_BUDGET_EXCEEDED"
}
```

### Campaign overview
```json
GET /v1/admin/overview?projectId=0f769c40-...

Response 200:
{
  "totalCampaigns": 1,
  "enabledCampaigns": 1,
  "totalDailySpeck": "0"
}
```

---

*Documentation generated for AetherDust v0.1.0*
