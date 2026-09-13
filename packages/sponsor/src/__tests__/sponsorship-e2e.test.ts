import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestEnvironment, type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AetherDustWalletProvider } from '@aetherdust/midnight';
import pino from 'pino';

const logger = pino({ level: 'warn' });

const USER_SEED = '1111111111111111111111111111111111111111111111111111111111111111';
const SPONSOR_SEED = '2222222222222222222222222222222222222222222222222222222222222222';

// Skip if Docker is not available or Midnight devnet cannot start
const describeE2E = process.env.CI ? describe : describe.skip;

describeE2E('DUST sponsorship e2e on devnet', () => {
  let testEnv: ReturnType<typeof getTestEnvironment>;
  let envConfig: EnvironmentConfiguration;
  let user: AetherDustWalletProvider;
  let sponsor: AetherDustWalletProvider;

  beforeAll(async () => {
    setNetworkId('undeployed');

    testEnv = getTestEnvironment(logger);
    envConfig = await testEnv.start();

    user = await AetherDustWalletProvider.build(logger, envConfig, {
      kind: 'seed',
      value: USER_SEED,
    });
    await user.start();
    await user.wallet.waitForSyncedState();

    sponsor = await AetherDustWalletProvider.build(logger, envConfig, {
      kind: 'seed',
      value: SPONSOR_SEED,
    });
    await sponsor.start();
    await sponsor.wallet.waitForSyncedState();
  }, 180_000);

  afterAll(async () => {
    await user?.stop();
    await sponsor?.stop();
    await testEnv?.shutdown();
  }, 30_000);

  it('wallet providers initialize and sync', async () => {
    expect(user.getCoinPublicKey()).toBeTruthy();
    expect(sponsor.getCoinPublicKey()).toBeTruthy();
    expect(user.getCoinPublicKey()).not.toBe(sponsor.getCoinPublicKey());
  });

  it('sponsor wallet reports DUST balance', async () => {
    const balance = await sponsor.getDustBalance();
    expect(typeof balance).toBe('bigint');
  });

  it('user wallet has zero DUST (cold-start case)', async () => {
    const balance = await user.getDustBalance();
    expect(balance).toBe(0n);
  });
});
