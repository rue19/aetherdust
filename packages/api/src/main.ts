import 'dotenv/config';
import pino from 'pino';
import { buildFullServer } from './index.js';
import { PostgresUsageLedger, getCampaignById, closePool, writeAuditLog } from '@aetherdust/database';
import { MockWalletProvider } from './mock-wallet.js';
import { getCBState, setCBState, circuitBreakerConfigs } from './circuit-breaker-store.js';

const PORT = parseInt(process.env.PORT ?? '3000');
const HOST = process.env.HOST ?? '0.0.0.0';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  const sponsorWallet = new MockWalletProvider(logger);

  const app = await buildFullServer({
    logger,
    sponsorWallet: sponsorWallet as any,
    getCampaign: getCampaignById,
    usageLedger: new PostgresUsageLedger(),
    recordUsage: async (campaignId, usageId, feeSpeck, status, reason) => {
      await writeAuditLog({
        actorType: 'system',
        action: `sponsor.${status}`,
        targetType: 'campaign',
        targetId: campaignId,
        metadata: { usageId, feeSpeck: feeSpeck.toString(), reason },
      });
    },
    circuitBreaker: {
      config: circuitBreakerConfigs,
      getState: getCBState,
      setState: setCBState,
    },
  });

  await app.listen({ port: PORT, host: HOST });
  logger.info(`AetherDust API listening on ${HOST}:${PORT}`);

  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    await closePool();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal(err, 'Failed to start server');
  process.exit(1);
});
