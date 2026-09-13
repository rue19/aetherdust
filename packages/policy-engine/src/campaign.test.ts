import { describe, it, expect, vi } from 'vitest';
import { evaluateCampaignPolicy, type Campaign, type UsageLedger } from './campaign.js';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'camp-1',
    projectId: 'proj-1',
    name: 'Test Campaign',
    enabled: true,
    dailyBudgetSpeck: 50_000_000_000_000n,
    perTransactionLimitSpeck: 1_000_000_000_000n,
    perUserTransactionLimit: 10,
    epochDurationSeconds: 86400,
    allowedContracts: ['0x1234'],
    allowedEntryPoints: ['checkin'],
    startTime: new Date('2020-01-01'),
    endTime: null,
    ...overrides,
  };
}

function makeUsageLedger(overrides: Partial<UsageLedger> = {}): UsageLedger {
  return {
    spentTodaySpeck: async () => 0n,
    usageCountThisEpoch: async () => 0,
    ...overrides,
  };
}

describe('evaluateCampaignPolicy', () => {
  it('allows valid request', async () => {
    const campaign = makeCampaign();
    const result = await evaluateCampaignPolicy(campaign, {
      campaignId: 'camp-1',
      contractAddress: '0x1234',
      entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n,
      usageId: 'user-1',
    }, makeUsageLedger());
    expect(result.allowed).toBe(true);
  });

  it('rejects CAMPAIGN_DISABLED', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign({ enabled: false }), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger());
    expect(result).toEqual({ allowed: false, reason: 'CAMPAIGN_DISABLED' });
  });

  it('rejects CAMPAIGN_NOT_STARTED', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign({ startTime: new Date('2099-01-01') }), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger());
    expect(result).toEqual({ allowed: false, reason: 'CAMPAIGN_NOT_STARTED' });
  });

  it('rejects CAMPAIGN_EXPIRED', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign({ endTime: new Date('2020-01-02') }), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger(), new Date('2020-01-03'));
    expect(result).toEqual({ allowed: false, reason: 'CAMPAIGN_EXPIRED' });
  });

  it('rejects CONTRACT_NOT_ALLOWED', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign(), {
      campaignId: 'camp-1', contractAddress: '0xbad', entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger());
    expect(result).toEqual({ allowed: false, reason: 'CONTRACT_NOT_ALLOWED' });
  });

  it('rejects ENTRYPOINT_NOT_ALLOWED', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign(), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'bad',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger());
    expect(result).toEqual({ allowed: false, reason: 'ENTRYPOINT_NOT_ALLOWED' });
  });

  it('rejects FEE_TOO_HIGH', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign(), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 2_000_000_000_000n, usageId: 'user-1',
    }, makeUsageLedger());
    expect(result).toEqual({ allowed: false, reason: 'FEE_TOO_HIGH' });
  });

  it('rejects BUDGET_EXCEEDED', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign(), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger({ spentTodaySpeck: async () => 50_000_000_000_000n }));
    expect(result).toEqual({ allowed: false, reason: 'BUDGET_EXCEEDED' });
  });

  it('rejects USER_LIMIT_EXCEEDED', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign(), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger({ usageCountThisEpoch: async () => 10 }));
    expect(result).toEqual({ allowed: false, reason: 'USER_LIMIT_EXCEEDED' });
  });

  it('rejects when both budget and user limit would be exceeded', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign({ perUserTransactionLimit: 1 }), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 100_000_000n, usageId: 'user-1',
    }, makeUsageLedger({
      spentTodaySpeck: async () => 50_000_000_000_000n,
      usageCountThisEpoch: async () => 1,
    }));
    expect(result.allowed).toBe(false);
  });

  it('allows at boundary (budget exactly at limit)', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign({ dailyBudgetSpeck: 100n }), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 0n, usageId: 'user-1',
    }, makeUsageLedger({ spentTodaySpeck: async () => 100n }));
    expect(result.allowed).toBe(true);
  });

  it('rejects when budget + fee exceeds limit by 1', async () => {
    const result = await evaluateCampaignPolicy(makeCampaign({ dailyBudgetSpeck: 100n }), {
      campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin',
      estimatedFeeSpeck: 1n, usageId: 'user-1',
    }, makeUsageLedger({ spentTodaySpeck: async () => 100n }));
    expect(result).toEqual({ allowed: false, reason: 'BUDGET_EXCEEDED' });
  });
});
