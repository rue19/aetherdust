# AetherDust — Technical Validation Report (Phase 0/1 recon)

Date: 2026-09-12. This covers reconnaissance and architecture only — no live
devnet run in this environment (sandboxed container, no access to a Midnight
node/indexer/proof server). Everything below is either sourced from official
Midnight material or explicitly flagged as unverified.

## 1. Headline finding

**The PRD's core assumption is correct and already exists as an official,
documented, tested pattern.** Midnight ships an official guide —
[docs.midnight.network/guides/dust-sponsorship](https://docs.midnight.network/guides/dust-sponsorship)
— plus a runnable reference implementation,
[midnightntwrk/example-private-party](https://github.com/midnightntwrk/example-private-party),
with a full technical writeup in its `docs/SPONSORSHIP.md`. AetherDust is not
inventing sponsorship; it's productizing an existing SDK-level mechanism
(policy, budgets, dashboard, self-hosting) that Midnight already supports at
the wallet layer.

## 2. APIs used (with source)

| Capability | Package | Function/Type | Source |
|---|---|---|---|
| User-side balancing (value only, no DUST) | `@midnight-ntwrk/wallet-sdk` (`WalletFacade`) | `balanceUnboundTransaction(tx, keys, { tokenKindsToBalance: ['shielded','unshielded'] })` | docs.midnight.network/guides/dust-sponsorship; example-private-party `src/wallet.ts` |
| Sponsor-side balancing (DUST only) | `@midnight-ntwrk/wallet-sdk` | `balanceFinalizedTransaction(tx, keys, { tokenKindsToBalance: ['dust'] })` | same |
| Sign / bind | `WalletFacade` | `signRecipe(recipe, signer)`, `finalizeRecipe(recipe)` | same |
| Submit | `WalletFacade` | `submitTransaction(tx)` | same |
| Transaction reconstruction | `@midnight-ntwrk/midnight-js-protocol/ledger` | `Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature','proof','binding', bytes)` | example-private-party `src/sponsor.ts` — exact generic arguments required |
| DUST balance read | `WalletFacade` | `state.dust.balance(now)` via `waitForSyncedState()` | example-private-party `src/wallet.ts` |
| Wallet construction | `@midnight-ntwrk/testkit-js` | `FluentWalletBuilder.forEnvironment(env).withDustOptions(...).withSeed/withMnemonic(...)` | same |
| Types package | `@midnight-ntwrk/midnight-js-types@4.1.1` (Apache-2.0, confirmed live on npm registry) | `WalletProvider`, `MidnightProvider`, `UnboundTransaction` | npm registry lookup performed in this session |

**Not verified — flagged rather than guessed:**
- The exact import path for `createUnprovenCallTx` (used to build a call
  transaction from a Compact circuit). The docs page shows it in use but not
  its import. Must be pinned against the [support matrix](https://docs.midnight.network/relnotes/support-matrix)
  before wiring a real demo contract.
- Whether a standalone transaction *simulation* API (distinct from local
  proving) exists. No evidence of one was found. Per PRD §10/§Phase 5, we do
  **not** claim simulation — see `packages/preflight/src/preflight.ts` for
  the documented reasoning.

## 3. Core sponsorship flow (verified)

```
USER (zero DUST)                          SPONSOR (holds NIGHT registered
                                            for DUST generation)
1. createUnprovenCallTx(circuit call)
2. proofProvider.proveTx(...)              — proof stays on user's device
3. balanceUnboundTransaction(
     ['shielded','unshielded'])            — pays own value, never DUST
4. signRecipe + finalizeRecipe             — BINDS the transaction
        │
        └── hex(FinalizedTransaction) ──────▶ 5. Transaction.deserialize(...)
                                            6. balanceFinalizedTransaction(['dust'])
                                            7. signRecipe + finalizeRecipe
                                            8. submitTransaction → txId
```

Security properties, all confirmed by Midnight's own docs and by an
executable test in the reference repo (`sponsorship.test.ts`, "Alice cannot
check in as Dave"):
- Sponsor can only **add** a DUST fee offer to an already-bound transaction — cannot alter it.
- Sponsor never receives the user's private key or circuit witness — the user is always the prover.
- The smart contract must authenticate by a proven secret, never by `ownPublicKey()` (a prover-controlled witness) or by "who paid."
- DUST is non-transferable — it cannot be drained to an external address, only spent on fees the sponsor's policy already approved.

## 4. What this means for the PRD

| PRD assumption | Status |
|---|---|
| "Programmable sponsorship layer sitting between DApp and Midnight" | Matches the real architecture: sponsorship is a wallet-side + backend-policy mechanism, not a protocol change. |
| Pre-flight can reject before spending DUST | Confirmed via policy checks (budget, allowlist, fee ceiling) run before `balanceFinalizedTransaction`. **Cannot** claim general failure prediction — no simulation API found. |
| "AetherDust should never require the user's private key" | Structurally guaranteed by the SDK split, not just a policy choice. |
| Privacy-preserving rate limiting via nullifiers (§11–12) | Technically plausible using Compact, but **not verified in this session** — needs a dedicated Phase 7 investigation against `midnight-zk`/Compact docs before committing to the hackathon demo. Flagging per PRD's own instruction: don't fake it if it isn't confirmed. |
| Sponsor wallet economics | Confirmed: DUST generates from *registered* NIGHT (registration is a separate step from holding NIGHT) at roughly 5 DUST per NIGHT under initial parameters, and decays over about a week if the backing NIGHT is spent. |

## 5. Immediate next hard gate (per the user's own stated ordering)

Before building further: clone `example-private-party`, run
`yarn env:up && yarn wait:dust && yarn test:sponsorship` against a real local
devnet. That is Step 2 in the requested build order and it cannot be done
inside this sandboxed session — it needs a Midnight local devnet (node,
indexer, proof server), which is outside this container's network access.
Everything in `packages/` here is structurally correct against the verified
API surface but is **untested against a live devnet**.

## 6. Known limitations of this pass

- No live Preprod/devnet transaction was submitted or observed.
- `createUnprovenCallTx` import path unverified.
- Privacy/nullifier feasibility (Phase 7) not investigated.
- Dashboard, demo DApp, and Docker Compose are not built in this pass — see
  README "Build status" for what exists vs. what's next.
