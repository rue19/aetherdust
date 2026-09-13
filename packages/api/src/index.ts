import Fastify from 'fastify';
import pino from 'pino';
import { runPreflight, type RawSponsorPayload } from '@aetherdust/preflight';
import { recordSpendAndCheck, type CircuitBreakerConfig, type CircuitBreakerState } from '@aetherdust/preflight';
import { sponsorAndSubmit } from '@aetherdust/sponsor';
import type { AetherDustWalletProvider } from '@aetherdust/midnight';
import type { Campaign, UsageLedger } from '@aetherdust/policy-engine';
import { registerCors } from './plugins/cors.js';
import { metricsPlugin } from './plugins/metrics.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { requireApiKey, requireScope } from './middleware/auth.js';
import { campaignRoutes } from './routes/campaigns.js';
import { transactionRoutes } from './routes/transactions.js';
import { analyticsRoutes } from './routes/analytics.js';
import { adminRoutes } from './routes/admin.js';
import { getCampaignById, PostgresUsageLedger, createTransaction, updateTransaction, recordUsage } from '@aetherdust/database';
import { circuitBreakerConfigs, getCBState, setCBState } from './circuit-breaker-store.js';

export interface AppDeps {
  logger: pino.Logger;
  sponsorWallet: AetherDustWalletProvider;
  getCampaign: (id: string) => Promise<Campaign | null>;
  usageLedger: UsageLedger;
  recordUsage: (campaignId: string, usageId: string, feeSpeck: bigint, status: 'sponsored' | 'rejected', reason?: string) => Promise<void>;
  circuitBreaker: { config: CircuitBreakerConfig; getState: (campaignId: string) => CircuitBreakerState; setState: (campaignId: string, s: CircuitBreakerState) => void };
}

export async function buildFullServer(deps: AppDeps) {
  const app = Fastify({
    logger: true,
    bodyLimit: 1024 * 1024,
  });

  await registerCors(app);
  await app.register(metricsPlugin);

  app.addHook('onRequest', sanitizeInput);

  const rateLimitRps = parseInt(process.env.RATE_LIMIT_RPS ?? '10');
  const rateWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '1000');
  app.addHook('onRequest', rateLimitMiddleware(rateLimitRps, rateWindowMs));

  app.get('/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  app.post<{ Body: RawSponsorPayload }>('/v1/sponsor', { onRequest: [requireApiKey, requireScope('sponsor')] }, async (req, reply) => {
    const payload = req.body;

    const campaign = payload.campaignId ? await deps.getCampaign(payload.campaignId) : null;
    if (!campaign) {
      return reply.code(404).send({ status: 'rejected', reason: 'INVALID_TRANSACTION', detail: 'unknown campaignId' });
    }

    if (payload.estimatedFeeSpeck !== undefined && typeof payload.estimatedFeeSpeck !== 'bigint') {
      payload.estimatedFeeSpeck = BigInt(payload.estimatedFeeSpeck);
    }

    const txRecord = await createTransaction({
      campaignId: campaign.id,
      status: 'pending',
      transactionHex: payload.transactionHex,
      dustFeeSpeck: payload.estimatedFeeSpeck ?? 0n,
      contractAddress: payload.contractAddress,
      entryPoint: payload.entryPoint,
      usageId: payload.usageId ?? 'unknown',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const sponsorBalance = await deps.sponsorWallet.getDustBalance();
    const result = await runPreflight(payload, campaign, deps.usageLedger, sponsorBalance);

    if (!result.allowed) {
      await updateTransaction(txRecord.id, { status: 'rejected', rejectionReason: result.reason });
      await deps.recordUsage(campaign.id, payload.usageId ?? 'unknown', 0n, 'rejected', result.reason);
      return reply.code(200).send({ status: 'rejected', reason: result.reason });
    }

    const breakerState = recordSpendAndCheck(
      deps.circuitBreaker.getState(campaign.id),
      payload.estimatedFeeSpeck ?? 0n,
      deps.circuitBreaker.config,
    );
    deps.circuitBreaker.setState(campaign.id, breakerState);
    if (breakerState.tripped) {
      await updateTransaction(txRecord.id, { status: 'rejected', rejectionReason: 'BUDGET_EXCEEDED' });
      deps.logger.warn({ campaignId: campaign.id }, 'circuit breaker tripped — campaign auto-paused');
      return reply.code(200).send({ status: 'rejected', reason: 'BUDGET_EXCEEDED', detail: 'circuit breaker tripped' });
    }

    try {
      const txId = await sponsorAndSubmit(deps.logger, deps.sponsorWallet, payload.transactionHex);
      await updateTransaction(txRecord.id, { status: 'sponsored', txHash: txId });
      await deps.recordUsage(campaign.id, payload.usageId!, payload.estimatedFeeSpeck ?? 0n, 'sponsored');
      return reply.code(200).send({ status: 'approved', transaction: txId, sponsorship: { dust: (payload.estimatedFeeSpeck ?? 0n).toString() } });
    } catch (err) {
      deps.logger.error({ err }, 'sponsorship submission failed');
      if (process.env.NODE_ENV === 'development') {
        deps.logger.warn('Falling back to mock tx in development mode');
        const mockTxId = `mock-tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await updateTransaction(txRecord.id, { status: 'sponsored', txHash: mockTxId });
        await deps.recordUsage(campaign.id, payload.usageId!, payload.estimatedFeeSpeck ?? 0n, 'sponsored');
        return reply.code(200).send({ status: 'approved', transaction: mockTxId, sponsorship: { dust: (payload.estimatedFeeSpeck ?? 0n).toString() }, mock: true });
      }
      await updateTransaction(txRecord.id, { status: 'failed', rejectionReason: 'SUBMISSION_FAILED' });
      return reply.code(500).send({ status: 'error', reason: 'SUBMISSION_FAILED', detail: err instanceof Error ? err.message : 'unknown error' });
    }
  });

  await app.register(campaignRoutes);
  await app.register(transactionRoutes);
  await app.register(analyticsRoutes);
  await app.register(adminRoutes);

  return app;
}
