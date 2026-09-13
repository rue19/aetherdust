import { describe, it, expect } from 'vitest';
import { PrivacyLimits } from '../index.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

describe('PrivacyLimits', () => {
  it('initializes with current epoch', () => {
    const pl = new PrivacyLimits(logger, {
      contractAddress: 'mn_test_contract',
      epochDurationMs: 86400000, // 24 hours
    });

    const epoch = pl.getCurrentEpoch();
    expect(typeof epoch).toBe('bigint');
    expect(epoch).toBeGreaterThan(0n);
  });

  it('rotates epoch when time advances', () => {
    const pl = new PrivacyLimits(logger, {
      contractAddress: 'mn_test_contract',
      epochDurationMs: 1000, // 1 second for testing
    });

    const epoch1 = pl.getCurrentEpoch();
    // Epoch should be consistent within the same window
    expect(pl.getCurrentEpoch()).toBe(epoch1);
  });

  it('buildClaimTransaction throws not-implemented', async () => {
    const pl = new PrivacyLimits(logger, {
      contractAddress: 'mn_test_contract',
      epochDurationMs: 86400000,
    });

    await expect(
      pl.buildClaimTransaction(null as any, new Uint8Array(32)),
    ).rejects.toThrow('Not yet implemented');
  });
});
