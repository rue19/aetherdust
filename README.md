# AetherDust

Open-source, self-hostable DUST sponsorship infrastructure for Midnight DApps.
Lets a DApp sponsor gasless transactions for users with zero DUST, while
keeping budgets, policy, abuse prevention, and privacy in the developer's
control. See `docs/TECHNICAL_VALIDATION.md` for what's been verified against
Midnight's actual SDK vs. what's still open.

## Build status

| Phase | Status |
|---|---|
| 0 — Technical reconnaissance | **Done.** Real APIs identified and cited. |
| 1 — Verify core sponsorship flow on a live devnet | **Code written.** E2e test with testkit-js (skipped locally, runs in CI with Docker). |
| 2 — Architecture / monorepo | Done. |
| 3 — Sponsorship API | `POST /v1/sponsor`, `/v1/campaigns`, `/v1/transactions`, `/v1/analytics` all implemented. |
| 4 — Policy engine | Done: budget, per-tx limit, per-user limit, contract/entry-point allowlist, campaign window. |
| 5 — Pre-flight | Done, scoped honestly: structural + policy checks only. No simulation claim (none found to exist). |
| 6 — Sponsor engine | Done, adapted from Midnight's own reference implementation. |
| 7 — Privacy limit prototype | **Compact contract written.** TypeScript integration stubs created (`@aetherdust/privacy-limits`). Needs Compact compiler integration. |
| 8 — Database | Done: Drizzle ORM, 7 tables, 7 repositories, migrations, seed script. |
| 9 — Security (auth, rate limiting) | Done: API key auth, JWT admin auth, rate limiting, input sanitization, bcrypt passwords. |
| 10 — Dashboard | Done: React SPA with 7 pages (Login, Campaigns, Transactions, API Keys, Audit Log, Health). |
| 11 — Demo DApp | **Scaffolded.** Counter contract + React frontend in `packages/demo-dapp/`. Needs Compact compiler integration. |
| 12 — Self-hosting / Docker | Done: Docker Compose (Postgres + API + Dashboard), multi-stage Dockerfiles. |
| 13 — Tests | 38 tests across 6 files (policy engine, preflight, circuit breaker, API, privacy limits). |
| 14 — CI/CD | Done: GitHub Actions (typecheck, lint, test, build, Docker publish to ghcr.io). |

## Repo layout

```
aetherdust/
├── packages/
│   ├── midnight/         # wallet provider: user-side / sponsor-side balancing roles
│   ├── sponsor/          # prepareSponsoredCall (user) / sponsorAndSubmit (sponsor)
│   ├── policy-engine/    # campaign rules + deterministic rejection taxonomy
│   ├── preflight/        # pre-sponsorship checks + circuit breaker
│   ├── database/         # Drizzle ORM schema, migrations, repositories
│   ├── api/              # Fastify REST API with auth, rate limiting, metrics
│   ├── privacy-limits/   # nullifier-based privacy limits (Compact/ZK)
│   ├── dashboard/        # React admin SPA
│   └── demo-dapp/        # demo DApp showing gasless transactions
├── contracts/            # Compact smart contracts
├── docs/
├── .github/workflows/    # CI/CD pipeline
└── docker-compose.yml
```

## Quick start

```bash
npm install
npm run build
npm run dev          # starts API on :3000
npm run dev:demo     # starts demo DApp on :5173
```

Requires a Midnight devnet or Preprod endpoint and a sponsor wallet with NIGHT
registered for DUST generation — see
[docs.midnight.network/guides/dust-sponsorship](https://docs.midnight.network/guides/dust-sponsorship).

## Environment variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — admin JWT signing secret
- `SPONSOR_WALLET_SEED` — sponsor wallet seed (64 hex chars)
- `MIDNIGHT_NETWORK_ENDPOINT` — Midnight node URL
- See `.env.example` for all options

## Attribution

`packages/midnight` and `packages/sponsor` are adapted from Midnight's
official reference implementation,
[midnightntwrk/example-private-party](https://github.com/midnightntwrk/example-private-party)
(Apache-2.0). See inline comments for what changed.

## License

Apache-2.0
