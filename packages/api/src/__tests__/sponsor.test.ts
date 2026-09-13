import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { buildFullServer } from '../index.js';
import { MockWalletProvider } from '../mock-wallet.js';
import { getCBState, setCBState, circuitBreakerConfigs } from '../circuit-breaker-store.js';
import type { Campaign, UsageLedger } from '@aetherdust/policy-engine';

vi.mock('@aetherdust/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aetherdust/database')>();
  return {
    ...actual,
    verifyApiKey: async (key: string) => {
      if (key === 'test-api-key') {
        return { id: 'k1', projectId: 'proj-1', keyPrefix: 'test', name: 'Test', scopes: ['sponsor', 'campaigns:read', 'analytics:read'], rateLimitRps: 100, enabled: true, lastUsedAt: null, createdAt: new Date(), expiresAt: null };
      }
      return null;
    },
    createTransaction: async (data: any) => ({
      id: 'tx-1', ...data, dustFeeSpeck: data.dustFeeSpeck ?? 0n, requestedAt: new Date(), processedAt: null, ipAddress: null, userAgent: null, txHash: null, rejectionReason: null,
    }),
    updateTransaction: async () => ({}),
  };
});

const DEMO_CAMPAIGN: Campaign = {
  id: 'camp-1', projectId: 'proj-1', name: 'Demo', enabled: true,
  dailyBudgetSpeck: 50_000_000_000_000n, perTransactionLimitSpeck: 1_000_000_000_000n,
  perUserTransactionLimit: 10, epochDurationSeconds: 86400,
  allowedContracts: ['0x1234'], allowedEntryPoints: ['checkin'],
  startTime: new Date('2020-01-01'), endTime: null,
};

const usageLedger: UsageLedger = {
  spentTodaySpeck: async () => 0n,
  usageCountThisEpoch: async () => 0,
};

let app: Awaited<ReturnType<typeof buildFullServer>>;

beforeAll(async () => {
  app = await buildFullServer({
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
    sponsorWallet: new MockWalletProvider() as any,
    getCampaign: async (id) => id === DEMO_CAMPAIGN.id ? DEMO_CAMPAIGN : null,
    usageLedger,
    recordUsage: async () => {},
    circuitBreaker: { config: circuitBreakerConfigs, getState: getCBState, setState: setCBState },
  });
  await app.ready();
});

afterAll(async () => { await app.close(); });

const AUTH = { authorization: 'Bearer test-api-key' };

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).status).toBe('ok');
  });
});

describe('POST /v1/sponsor', () => {
  it('rejects without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/sponsor',
      payload: { transactionHex: 'aabb', campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin', usageId: 'u1', estimatedFeeSpeck: 100 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects INVALID_TRANSACTION for unknown campaign', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/sponsor',
      headers: AUTH,
      payload: { transactionHex: 'aabb', campaignId: 'bad', usageId: 'u1' },
    });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.payload).reason).toBe('INVALID_TRANSACTION');
  });

  it('rejects CONTRACT_NOT_ALLOWED', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/sponsor',
      headers: AUTH,
      payload: { transactionHex: 'aabb', campaignId: 'camp-1', contractAddress: '0x9999', entryPoint: 'checkin', usageId: 'u1', estimatedFeeSpeck: 100000000 },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).reason).toBe('CONTRACT_NOT_ALLOWED');
  });

  it('rejects ENTRYPOINT_NOT_ALLOWED', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/sponsor',
      headers: AUTH,
      payload: { transactionHex: 'aabb', campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'bad', usageId: 'u1', estimatedFeeSpeck: 100000000 },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).reason).toBe('ENTRYPOINT_NOT_ALLOWED');
  });

  it('approves valid request', async () => {
    const res = await app.inject({
      method: 'POST', url: '/v1/sponsor',
      headers: AUTH,
      payload: { transactionHex: 'aabb', campaignId: 'camp-1', contractAddress: '0x1234', entryPoint: 'checkin', usageId: 'u1', estimatedFeeSpeck: 100000000 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('approved');
    expect(body.transaction).toMatch(/^mock-tx-/);
  });
});
