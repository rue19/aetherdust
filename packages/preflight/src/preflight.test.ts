import { describe, it, expect } from 'vitest';
import { runPreflight, type RawSponsorPayload } from './preflight.js';
import type { Campaign, UsageLedger } from '@aetherdust/policy-engine';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1', projectId: 'proj-1', name: 'Test', enabled: true,
    dailyBudgetSpeck: 50_000_000_000_000n, perTransactionLimitSpeck: 1_000_000_000_000n,
    perUserTransactionLimit: 10, epochDurationSeconds: 86400,
    allowedContracts: ['0x1234'], allowedEntryPoints: ['checkin'],
    startTime: new Date('2020-01-01'), endTime: null, ...overrides,
  };
}

function makeUsageLedger(overrides: Partial<UsageLedger> = {}): UsageLedger {
  return { spentTodaySpeck: async () => 0n, usageCountThisEpoch: async () => 0, ...overrides };
}

function validPayload(overrides: Partial<RawSponsorPayload> = {}): RawSponsorPayload {
  return {
    transactionHex: 'aabb',
    campaignId: 'camp-1',
    contractAddress: '0x1234',
    entryPoint: 'checkin',
    estimatedFeeSpeck: 100_000_000n,
    usageId: 'u1',
    ...overrides,
  };
}

describe('runPreflight', () => {
  it('rejects INVALID_TRANSACTION when transactionHex is empty', async () => {
    const result = await runPreflight(
      { ...validPayload(), transactionHex: '' },
      makeCampaign(), makeUsageLedger(), 1_000_000n,
    );
    expect(result).toEqual({ allowed: false, reason: 'INVALID_TRANSACTION', detail: 'malformed sponsor request' });
  });

  it('rejects INVALID_TRANSACTION when hex contains non-hex chars', async () => {
    const result = await runPreflight(
      { ...validPayload(), transactionHex: 'zzzz' },
      makeCampaign(), makeUsageLedger(), 1_000_000n,
    );
    expect(result).toEqual({ allowed: false, reason: 'INVALID_TRANSACTION', detail: 'malformed sponsor request' });
  });

  it('rejects INVALID_TRANSACTION when contractAddress missing', async () => {
    const result = await runPreflight(
      { ...validPayload(), contractAddress: undefined },
      makeCampaign(), makeUsageLedger(), 1_000_000n,
    );
    expect(result).toEqual({ allowed: false, reason: 'INVALID_TRANSACTION', detail: 'malformed sponsor request' });
  });

  it('rejects INVALID_TRANSACTION when entryPoint missing', async () => {
    const result = await runPreflight(
      { ...validPayload(), entryPoint: undefined },
      makeCampaign(), makeUsageLedger(), 1_000_000n,
    );
    expect(result).toEqual({ allowed: false, reason: 'INVALID_TRANSACTION', detail: 'malformed sponsor request' });
  });

  it('rejects SPONSOR_DUST_UNAVAILABLE when balance is too low', async () => {
    const result = await runPreflight(
      validPayload({ estimatedFeeSpeck: 100n }),
      makeCampaign(), makeUsageLedger(), 50n,
    );
    expect(result).toEqual({ allowed: false, reason: 'SPONSOR_DUST_UNAVAILABLE' });
  });

  it('allows valid payload', async () => {
    const result = await runPreflight(
      validPayload(),
      makeCampaign(), makeUsageLedger(), 1_000_000_000_000n,
    );
    expect(result.allowed).toBe(true);
  });

  it('rejects INVALID_TRANSACTION when estimatedFeeSpeck is negative', async () => {
    const result = await runPreflight(
      { ...validPayload(), estimatedFeeSpeck: -1n },
      makeCampaign(), makeUsageLedger(), 1_000_000n,
    );
    expect(result).toEqual({ allowed: false, reason: 'INVALID_TRANSACTION', detail: 'malformed sponsor request' });
  });
});
