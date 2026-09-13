import type { AetherDustWalletProvider } from '@aetherdust/midnight';
import type { Logger } from 'pino';

export interface PrivacyLimitsConfig {
  contractAddress: string;
  epochDurationMs: number;
}

export interface ClaimResult {
  success: boolean;
  nullifier?: string;
  error?: string;
}

/**
 * PrivacyLimits wraps the Compact privacy-limits contract and provides
 * a TypeScript API for nullifier-based rate limiting.
 *
 * Users call `claimSponsorship()` which:
 * 1. Derives a nullifier from their secret key and current epoch
 * 2. Proves they are registered (Merkle proof)
 * 3. Proves the nullifier hasn't been used this epoch
 * 4. Submits the transaction (with sponsor paying DUST fees)
 *
 * The sponsor never learns the user's identity — only the nullifier
 * is visible on-chain.
 */
export class PrivacyLimits {
  private currentEpoch: bigint;

  constructor(
    private readonly logger: Logger,
    private readonly config: PrivacyLimitsConfig,
  ) {
    this.currentEpoch = BigInt(Math.floor(Date.now() / config.epochDurationMs));
  }

  /**
   * Get the current epoch identifier.
   * Epoch rotates every `epochDurationMs` milliseconds.
   */
  getCurrentEpoch(): bigint {
    const now = BigInt(Math.floor(Date.now() / this.config.epochDurationMs));
    if (now !== this.currentEpoch) {
      this.logger.info({ oldEpoch: this.currentEpoch, newEpoch: now }, 'Epoch rotated');
      this.currentEpoch = now;
    }
    return this.currentEpoch;
  }

  /**
   * Build a claimSponsorship transaction for the given wallet.
   * This creates an unbound transaction that can be passed to
   * `prepareSponsoredCall()` for sponsorship.
   *
   * NOTE: This is a structural placeholder. The actual implementation
   * requires the compiled Compact contract artifacts and the Midnight
   * contract runtime. See contracts/privacy-limits.compact for the
   * contract source.
   */
  async buildClaimTransaction(
    _wallet: AetherDustWalletProvider,
    _secretKey: Uint8Array,
  ): Promise<unknown> {
    const epoch = this.getCurrentEpoch();
    this.logger.info({ epoch }, 'Building claimSponsorship transaction');

    // TODO: Once Compact compiler is integrated, this will:
    // 1. Load the compiled contract artifacts
    // 2. Create a WitnessContext with the secret key
    // 3. Call the claimSponsorship circuit
    // 4. Return the unbound transaction

    throw new Error(
      'Not yet implemented — requires Compact compiler integration. ' +
      'See contracts/privacy-limits.compact for the contract source.'
    );
  }

  /**
   * Check if a nullifier has been used in the current epoch.
   * This queries the on-chain Set<Bytes<32>> for the nullifier.
   */
  async isNullifierUsed(_nullifier: string): Promise<boolean> {
    // TODO: Query the contract's dailyUsedNullifiers Set
    throw new Error('Not yet implemented — requires Compact runtime integration');
  }

  /**
   * Register a user's public key commitment.
   * Called during onboarding to add the user to the Merkle tree.
   */
  async registerUser(_wallet: AetherDustWalletProvider, _publicKey: Uint8Array): Promise<void> {
    // TODO: Call the registerUser circuit
    throw new Error('Not yet implemented — requires Compact compiler integration');
  }
}

export { PrivacyLimits as default };
