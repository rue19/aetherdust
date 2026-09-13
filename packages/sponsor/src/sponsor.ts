// Adapted from midnightntwrk/example-private-party (src/sponsor.ts), Apache-2.0.
// Verified against docs.midnight.network/guides/dust-sponsorship (2026-09-12).
//
// NOTE ON THE IMPORT BELOW: the docs page shows createUnprovenCallTx used but
// not its import path. Pin this against the exact midnight-js version in
// docs.midnight.network/relnotes/support-matrix before wiring a real contract
// call — do not guess the package. Everything else here is taken verbatim
// from the verified reference implementation.
import {
  Transaction,
  type SignatureEnabled,
  type Proof,
  type Binding,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { Logger } from 'pino';
import type { AetherDustWalletProvider } from '@aetherdust/midnight';

/**
 * USER SIDE. Runs where the user's keys live (their browser wallet, in
 * production). Builds the call, proves it locally, balances only the
 * user's own value (never DUST), signs, and binds. The returned hex string
 * is the network boundary — nothing else may cross it.
 *
 * A wallet with zero DUST can run every line of this function.
 */
export async function prepareSponsoredCall(
  logger: Logger,
  user: AetherDustWalletProvider,
  buildAndProveUnboundTx: () => Promise<import('@midnight-ntwrk/midnight-js-types').UnboundTransaction>,
): Promise<string> {
  const unboundTx = await buildAndProveUnboundTx();
  const finalized = await user.balanceOwnValueAndFinalize(unboundTx);
  return toHex(finalized.serialize());
}

/**
 * SPONSOR SIDE. Typically a small backend service. Deserializes the user's
 * already-bound transaction, attaches a DUST fee offer, signs, finalizes,
 * and submits. Never touches the user's proof or private inputs — it has no
 * way to.
 *
 * The exact type arguments on Transaction.deserialize are required: the
 * marker triple alone infers a wider type than FinalizedTransaction.
 */
export async function sponsorAndSubmit(
  logger: Logger,
  sponsor: AetherDustWalletProvider,
  userTxHex: string,
): Promise<string> {
  const userTx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    fromHex(userTxHex),
  );
  const sponsored = await sponsor.addDustFeesAndFinalize(userTx);
  return sponsor.wallet.submitTransaction(sponsored);
}
