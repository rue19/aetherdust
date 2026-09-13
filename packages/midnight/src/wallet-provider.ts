// Adapted from midnightntwrk/example-private-party (src/wallet.ts), Apache-2.0.
// Original: Copyright (C) Midnight Foundation. See NOTICE.md in this repo.
// Changes: renamed to AetherDustWalletProvider, added a role marker and a
// sponsor-side spend-accounting hook so the policy engine can observe how
// much DUST a sponsorship actually consumed.
//
// Verified against docs.midnight.network/guides/dust-sponsorship (retrieved
// 2026-09-12) and midnightntwrk/example-private-party@main. See
// /docs/TECHNICAL_VALIDATION.md for the full source trail.

import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  type MidnightProvider,
  type UnboundTransaction,
  type WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import type {
  WalletFacade,
  UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk';
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from '@midnight-ntwrk/testkit-js';
import type { Logger } from 'pino';

export type WalletSecret =
  | { kind: 'seed'; value: string }
  | { kind: 'mnemonic'; value: string };

export type WalletRole = 'user' | 'sponsor';

/**
 * AetherDustWalletProvider wraps a Midnight WalletFacade and exposes exactly
 * the two role-scoped balancing operations sponsorship needs. Nothing in
 * this file ever moves a private key or a proof across the role boundary —
 * that boundary is the entire security argument of DUST sponsorship.
 */
export class AetherDustWalletProvider implements MidnightProvider, WalletProvider {
  readonly wallet: WalletFacade;
  readonly unshieldedKeystore: UnshieldedKeystore;

  private constructor(
    private readonly logger: Logger,
    private readonly env: EnvironmentConfiguration,
    wallet: WalletFacade,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    unshieldedKeystore: UnshieldedKeystore,
  ) {
    this.wallet = wallet;
    this.unshieldedKeystore = unshieldedKeystore;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  /**
   * USER SIDE of sponsorship. Balances only the caller's own value
   * (shielded + unshielded), NEVER dust, then signs and finalizes (binds).
   * A wallet with zero DUST can run every line of this method — that is
   * the entire point.
   */
  async balanceOwnValueAndFinalize(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl, tokenKindsToBalance: ['shielded', 'unshielded'] },
    );
    const signed = await this.wallet.signRecipe(recipe, (payload) =>
      this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signed);
  }

  /**
   * General balance + finalize used by the WalletProvider interface.
   * Balances all token kinds (both own value and DUST), signs, and finalizes.
   */
  async balanceTx(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl, tokenKindsToBalance: ['shielded', 'unshielded', 'dust'] },
    );
    const signed = await this.wallet.signRecipe(recipe, (payload) =>
      this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signed);
  }

  /**
   * SPONSOR SIDE of sponsorship. Takes an already-proven, already-bound
   * FinalizedTransaction and attaches ONLY a DUST fee offer. Cannot alter
   * what the transaction does and never sees the user's private inputs —
   * it has no way to.
   */
  async addDustFeesAndFinalize(
    tx: FinalizedTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceFinalizedTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl, tokenKindsToBalance: ['dust'] },
    );
    const signed = await this.wallet.signRecipe(recipe, (payload) =>
      this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signed);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  /** Current spendable DUST, in SPECK. Zero means this wallet cannot pay any fee. */
  async getDustBalance(): Promise<bigint> {
    const state = await this.wallet.waitForSyncedState();
    return state.dust.balance(new Date());
  }

  async start(): Promise<void> {
    this.logger.info('Starting wallet...');
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  static async build(
    logger: Logger,
    env: EnvironmentConfiguration,
    secret: WalletSecret,
  ): Promise<AetherDustWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      // Headroom above the SDK default of 0n. The reference implementation
      // notes sponsor-side "could not balance dust" failures are almost
      // always this margin being too thin, not an actual empty wallet.
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };

    const base = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
    const builder = secret.kind === 'mnemonic' ? base.withMnemonic(secret.value) : base.withSeed(secret.value);
    const { wallet, seeds, keystore } = (await builder.buildWithoutStarting()) as {
      wallet: WalletFacade;
      seeds: { masterSeed: string; shielded: Uint8Array; unshielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };

    return new AetherDustWalletProvider(
      logger,
      env,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
    );
  }
}
