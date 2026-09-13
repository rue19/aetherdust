import type { FastifyInstance } from 'fastify';
import { listTransactions, getTransactionById } from '@aetherdust/database';
import { requireApiKey, requireScope } from '../middleware/auth.js';

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requireApiKey);
  app.addHook('onRequest', requireScope('sponsor'));

  app.get('/v1/transactions', async (request, reply) => {
    const { campaignId, status, limit, offset } = request.query as {
      campaignId?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    const transactions = await listTransactions({
      campaignId,
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    return reply.send({ transactions, total: transactions.length });
  });

  app.get('/v1/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tx = await getTransactionById(id);
    if (!tx) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Transaction not found' });
    }
    return reply.send({ transaction: tx });
  });
}
