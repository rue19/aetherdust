import 'dotenv/config';
import pino from 'pino';
import { buildFullServer } from './index.js';
import { PostgresUsageLedger, getCampaignById, closePool, writeAuditLog } from '@aetherdust/database';
import { MockWalletProvider } from './mock-wallet.js';
import { AetherDustWalletProvider } from '@aetherdust/midnight';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { getCBState, setCBState, circuitBreakerConfigs } from './circuit-breaker-store.js';

const PORT = parseInt(process.env.PORT ?? '3000');
const HOST = process.env.HOST ?? '0.0.0.0';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  let sponsorWallet: AetherDustWalletProvider | MockWalletProvider;

  const walletSeed = process.env.SPONSOR_WALLET_SEED;
  const networkEndpoint = process.env.MIDNIGHT_NETWORK_ENDPOINT;

  if (walletSeed && networkEndpoint) {
    logger.info('Using real Midnight wallet provider');
    setNetworkId(process.env.MIDNIGHT_NETWORK_ID ?? 'undeployed');
    sponsorWallet = await AetherDustWalletProvider.build(logger, {
      walletNetworkId: process.env.MIDNIGHT_NETWORK_ID ?? 'undeployed',
      networkId: process.env.MIDNIGHT_NETWORK_ID ?? 'undeployed',
      node: networkEndpoint,
      nodeWS: process.env.MIDNIGHT_NODE_WS_ENDPOINT ?? networkEndpoint.replace('http', 'ws'),
      indexer: process.env.MIDNIGHT_INDEXER_ENDPOINT ?? `${networkEndpoint}/indexer`,
      indexerWS: process.env.MIDNIGHT_INDEXER_WS_ENDPOINT ?? `${networkEndpoint}/indexer/ws`,
      proofServer: process.env.MIDNIGHT_PROOF_SERVER ?? 'http://127.0.0.1:6300',
      faucet: process.env.MIDNIGHT_FAUCET ?? '',
    }, { kind: 'seed', value: walletSeed });
    await sponsorWallet.start();
    const dustBalance = await sponsorWallet.getDustBalance();
    logger.info({ dustBalance }, 'Sponsor wallet DUST balance');
  } else {
    logger.warn('No SPONSOR_WALLET_SEED/MIDNIGHT_NETWORK_ENDPOINT set — using mock wallet');
    sponsorWallet = new MockWalletProvider(logger);
  }

  const app = await buildFullServer({
    logger,
    sponsorWallet: sponsorWallet as AetherDustWalletProvider,
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
