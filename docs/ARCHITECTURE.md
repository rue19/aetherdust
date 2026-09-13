# Architecture

## Overview

AetherDust is a DUST sponsorship infrastructure for Midnight blockchain DApps. It allows DApp operators to sponsor transaction fees for their users, with configurable policies, budgets, and rate limits.

## Packages

| Package | Description |
|---------|-------------|
| `@aetherdust/policy-engine` | Pure policy evaluation — allowlists, budgets, user limits |
| `@aetherdust/preflight` | Pre-submission checks — structure, policy, solvency |
| `@aetherdust/sponsor` | Transaction hex → wallet proof → network submit |
| `@aetherdust/midnight` | Midnight SDK wallet provider wrapper |
| `@aetherdust/database` | Drizzle ORM schema, migrations, repositories |
| `@aetherdust/api` | Fastify REST API with auth, CORS, rate limiting |
| `@aetherdust/dashboard` | React SPA for admin console |

## Request Flow

```
1. User sends POST /v1/sponsor { transactionHex, campaignId, ... }
2. API key validated (Bearer token → SHA-256 hash lookup)
3. Rate limit checked (sliding window per API key)
4. Input sanitized (XSS, injection patterns)
5. Structural validation (hex format, required fields)
6. Policy evaluation:
   a. Campaign enabled?
   b. Time window valid?
   c. Contract in allowlist?
   d. Entry point in allowlist?
   e. Fee within per-tx limit?
   f. Daily budget not exceeded?
   g. User not over limit?
7. Sponsor solvency check (wallet DUST balance > fee)
8. Circuit breaker check (rolling window spend)
9. Transaction submission to Midnight network
10. Audit log written
```

## Security Model

- **API Keys**: SHA-256 hashed, prefixed, scoped (`sponsor`, `campaigns:read`, `analytics:read`)
- **Admin Auth**: JWT tokens with 24h expiry, role-based (admin/viewer)
- **Rate Limiting**: Per-key sliding window, configurable RPS
- **Input Sanitization**: Pattern-based XSS/injection detection
- **CORS**: Configurable allowed origins

## Database Schema

7 tables: `projects`, `campaigns`, `transactions`, `usage_ledger`, `api_keys`, `admin_users`, `audit_log`.

See `packages/database/src/schema/index.ts` for the full Drizzle schema.
