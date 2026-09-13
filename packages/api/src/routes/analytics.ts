import type { FastifyInstance } from 'fastify';
import { getCampaignById, getDailySpend } from '@aetherdust/database';
import { requireApiKey, requireScope } from '../middleware/auth.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requireApiKey);
  app.addHook('onRequest', requireScope('analytics:read'));

  app.get('/v1/analytics/overview', async (request, reply) => {
    const projectId = request.apiKey!.projectId;
    const { listCampaigns } = await import('@aetherdust/database');
    const campaigns = await listCampaigns(projectId);
    let totalDailySpend = 0n;
    for (const c of campaigns) {
      const daily = await getDailySpend(c.id, 1);
      if (daily[0]) totalDailySpend += BigInt(daily[0].total);
    }
    return reply.send({
      totalCampaigns: campaigns.length,
      enabledCampaigns: campaigns.filter(c => c.enabled).length,
      totalDailySpeck: totalDailySpend.toString(),
    });
  });

  app.get('/v1/analytics/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { days } = request.query as { days?: string };
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    const daily = await getDailySpend(id, days ? parseInt(days) : 30);
    return reply.send({ campaign, dailySpend: daily });
  });
}
