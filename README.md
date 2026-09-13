# AetherDust

Open-source, self-hostable DUST sponsorship infrastructure for Midnight DApps.
Lets a DApp sponsor gasless transactions for users with zero DUST, while
keeping budgets, policy, abuse prevention, and privacy in the developer's
control. See `docs/TECHNICAL_VALIDATION.md` for what's been verified against
Midnight's actual SDK vs. what's still open.

## Build status (this pass)

| Phase | Status |
|---|---|
| 0 — Technical reconnaissance | **Done.** Real APIs identified and cited. |
| 1 — Verify core sponsorship flow on a live devnet | **Not run** — needs a Midnight local devnet, unavailable in this sandbox. Code is written against the exact verified API surface but untested end-to-end. |
| 2 — Architecture / monorepo | Done (this scaffold). |
| 3 — Sponsorship API | `POST /v1/sponsor` implemented; `/v1/campaigns`, `/v1/transactions/:id`, `/v1/analytics` not yet built. |
| 4 — Policy engine | Done: budget, per-tx limit, per-user limit, contract/entry-point allowlist, campaign window. |
| 5 — Pre-flight | Done, scoped honestly: structural + policy checks only. No simulation claim (none found to exist). |
| 6 — Sponsor engine | Done, adapted from Midnight's own reference implementation. |
| 7 — Privacy limit prototype | **Not started.** Needs its own Compact/ZK feasibility pass. |
| 8 — Database | Not started — `UsageLedger` interface exists, no Postgres implementation yet. |
| 9 — Security (auth, rate limiting) | Not started. |
| 10 — Dashboard | Not started. |
| 11 — Demo DApp | Not started. |
| 12 — Self-hosting / Docker | Not started. |
| 13–15 — Tests, failure testing, docs | Partial: `TECHNICAL_VALIDATION.md` only. |

**Honest read:** this is a real, SDK-grounded skeleton for Phases 2–6, not a
finished MVP. The single most important next step is Phase 1 — proving the
sponsorship flow against a real Midnight devnet — because everything else
depends on that working exactly as documented.

## Repo layout

```
aetherdust/
├── packages/
│   ├── midnight/         # wallet provider: user-side / sponsor-side balancing roles
│   ├── sponsor/          # prepareSponsoredCall (user) / sponsorAndSubmit (sponsor)
│   ├── policy-engine/    # campaign rules + deterministic rejection taxonomy
│   ├── preflight/        # pre-sponsorship checks + circuit breaker
│   └── api/              # Fastify POST /v1/sponsor
└── docs/
    └── TECHNICAL_VALIDATION.md
```

## Attribution

`packages/midnight` and `packages/sponsor` are adapted from Midnight's
official reference implementation,
[midnightntwrk/example-private-party](https://github.com/midnightntwrk/example-private-party)
(Apache-2.0). See inline comments for what changed.

## Running (once Phase 1 is done)

```bash
npm install
npm run build
npm run dev -w @aetherdust/api
```

Requires a Midnight devnet or Preprod endpoint and a sponsor wallet with NIGHT
registered for DUST generation — see
[docs.midnight.network/guides/dust-sponsorship](https://docs.midnight.network/guides/dust-sponsorship).
