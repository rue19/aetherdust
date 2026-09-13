import type { FastifyInstance } from 'fastify';
import { createApiKey, listApiKeys, revokeApiKey, writeAuditLog, listCampaigns, getCampaignById, updateCampaign, listTransactions, getDailySpend } from '@aetherdust/database';
import type { Campaign } from '@aetherdust/policy-engine';
import { requireAdminAuth, requireAdminRole, signAdminToken } from '../middleware/admin-auth.js';
import { verifyAdminUser } from '@aetherdust/database';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/admin/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    if (!email || !password) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Email and password required' });
    }
    const user = await verifyAdminUser(email, password);
    if (!user) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
    const token = signAdminToken({ id: user.id, email: user.email, role: user.role });
    await writeAuditLog({ actorId: user.id, actorType: 'admin', action: 'admin.login' });
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  app.addHook('onRequest', requireAdminAuth);

  app.get('/v1/admin/api-keys', async (request, reply) => {
    const projectId = (request.query as { projectId?: string }).projectId;
    if (!projectId) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'projectId query param required' });
    }
    const keys = await listApiKeys(projectId);
    return reply.send({ apiKeys: keys });
  });

  app.post('/v1/admin/api-keys', async (request, reply) => {
    const body = request.body as { projectId: string; name: string; scopes?: string[]; rateLimitRps?: number };
    if (!body.projectId || !body.name) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'projectId and name required' });
    }
    const key = await createApiKey(body);
    await writeAuditLog({
      actorId: request.adminUser?.id,
      actorType: 'admin',
      action: 'api_key.create',
      targetType: 'api_key',
      targetId: key.id,
      metadata: { name: body.name, projectId: body.projectId },
    });
    return reply.code(201).send({ apiKey: key });
  });

  app.delete('/v1/admin/api-keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const revoked = await revokeApiKey(id);
    if (!revoked) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'API key not found' });
    }
    await writeAuditLog({
      actorId: request.adminUser?.id,
      actorType: 'admin',
      action: 'api_key.revoke',
      targetType: 'api_key',
      targetId: id,
    });
    return reply.code(204).send();
  });

  app.get('/v1/admin/audit-log', async (request, reply) => {
    const { listAuditLog } = await import('@aetherdust/database');
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const entries = await listAuditLog({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    return reply.send({ entries });
  });

  app.get('/v1/admin/campaigns', async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'projectId query param required' });
    }
    const campaigns = await listCampaigns(projectId);
    return reply.send({ campaigns });
  });

  app.get('/v1/admin/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    return reply.send({ campaign });
  });

  app.patch('/v1/admin/campaigns/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    const updated = await updateCampaign(id, { enabled: !campaign.enabled });
    return reply.send({ campaign: updated });
  });

  app.get('/v1/admin/campaigns/:id/analytics', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { days } = request.query as { days?: string };
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    const dailySpend = await getDailySpend(id, days ? parseInt(days) : 30);
    return reply.send({ campaign, dailySpend });
  });

  app.get('/v1/admin/transactions', async (request, reply) => {
    const { campaignId, status, limit, offset } = request.query as {
      campaignId?: string; status?: string; limit?: string; offset?: string;
    };
    const transactions = await listTransactions({
      campaignId, status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    return reply.send({ transactions, total: transactions.length });
  });

  app.get('/v1/admin/overview', async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };
    if (!projectId) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'projectId query param required' });
    }
    const campaigns = await listCampaigns(projectId);
    let totalDailySpend = 0n;
    for (const c of campaigns) {
      const daily = await getDailySpend(c.id, 1);
      if (daily[0]) totalDailySpend += BigInt(daily[0].total);
    }
    return reply.send({
      totalCampaigns: campaigns.length,
      enabledCampaigns: campaigns.filter((c: Campaign) => c.enabled).length,
      totalDailySpeck: totalDailySpend.toString(),
    });
  });
}
