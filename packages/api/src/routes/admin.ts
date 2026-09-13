import type { FastifyInstance } from 'fastify';
import {
  createApiKey, listApiKeys, revokeApiKey, writeAuditLog,
  listCampaigns, getCampaignById, createCampaign, updateCampaign, deleteCampaign,
  listTransactions, getTransactionById,
  getDailySpend,
  createProject, listProjects,
  createAdminUser, listAdminUsers, deleteAdminUser,
} from '@aetherdust/database';
import type { Campaign } from '@aetherdust/policy-engine';
import { requireAdminAuth, requireAdminRole, signAdminToken } from '../middleware/admin-auth.js';
import { verifyAdminUser } from '@aetherdust/database';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // ── Public ──────────────────────────────────────────────────────
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

  // ── Projects ────────────────────────────────────────────────────
  app.get('/v1/admin/projects', async (request, reply) => {
    const { projectId } = request.query as { projectId?: string };
    const projects = projectId
      ? (await listProjects(projectId)).filter(p => p.id === projectId)
      : await listProjects(request.adminUser!.id);
    return reply.send({ projects });
  });

  app.post('/v1/admin/projects', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const { name } = request.body as { name: string };
    if (!name) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'name required' });
    }
    const project = await createProject({ name, ownerId: request.adminUser!.id });
    await writeAuditLog({ actorId: request.adminUser!.id, actorType: 'admin', action: 'project.create', targetType: 'project', targetId: project.id, metadata: { name } });
    return reply.code(201).send({ project });
  });

  // ── API Keys ────────────────────────────────────────────────────
  app.get('/v1/admin/api-keys', async (request, reply) => {
    const projectId = (request.query as { projectId?: string }).projectId;
    if (!projectId) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'projectId query param required' });
    }
    const keys = await listApiKeys(projectId);
    return reply.send({ apiKeys: keys });
  });

  app.post('/v1/admin/api-keys', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const body = request.body as { projectId: string; name: string; scopes?: string[]; rateLimitRps?: number };
    if (!body.projectId || !body.name) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'projectId and name required' });
    }
    const key = await createApiKey(body);
    await writeAuditLog({
      actorId: request.adminUser?.id, actorType: 'admin', action: 'api_key.create',
      targetType: 'api_key', targetId: key.id, metadata: { name: body.name, projectId: body.projectId },
    });
    return reply.code(201).send({ apiKey: key });
  });

  app.delete('/v1/admin/api-keys/:id', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const revoked = await revokeApiKey(id);
    if (!revoked) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'API key not found' });
    }
    await writeAuditLog({ actorId: request.adminUser?.id, actorType: 'admin', action: 'api_key.revoke', targetType: 'api_key', targetId: id });
    return reply.code(204).send();
  });

  // ── Audit Log ───────────────────────────────────────────────────
  app.get('/v1/admin/audit-log', async (request, reply) => {
    const { listAuditLog } = await import('@aetherdust/database');
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const entries = await listAuditLog({
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    return reply.send({ entries });
  });

  // ── Campaigns ───────────────────────────────────────────────────
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

  app.post('/v1/admin/campaigns', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    if (!body.projectId || !body.name) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'projectId and name required' });
    }
    const campaign = await createCampaign({
      projectId: body.projectId as string,
      name: body.name as string,
      dailyBudgetSpeck: BigInt(body.dailyBudgetSpeck as string ?? '0'),
      perTxLimitSpeck: BigInt(body.perTxLimitSpeck as string ?? '0'),
      perUserTxLimit: (body.perUserTxLimit as number) ?? 0,
      epochDurationSeconds: (body.epochDurationSeconds as number) ?? 86400,
      allowedContracts: (body.allowedContracts as string[]) ?? [],
      allowedEntryPoints: (body.allowedEntryPoints as string[]) ?? [],
      startTime: body.startTime ? new Date(body.startTime as string) : new Date(),
      endTime: body.endTime ? new Date(body.endTime as string) : null,
      cbWindowSeconds: (body.cbWindowSeconds as number) ?? 60,
      cbMaxSpeck: body.cbMaxSpeck ? BigInt(body.cbMaxSpeck as string) : undefined,
    });
    await writeAuditLog({ actorId: request.adminUser?.id, actorType: 'admin', action: 'campaign.create', targetType: 'campaign', targetId: campaign.id, metadata: { name: body.name } });
    return reply.code(201).send({ campaign });
  });

  app.put('/v1/admin/campaigns/:id', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const existing = await getCampaignById(id);
    if (!existing) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.dailyBudgetSpeck !== undefined) updateData.dailyBudgetSpeck = BigInt(body.dailyBudgetSpeck as string);
    if (body.perTxLimitSpeck !== undefined) updateData.perTxLimitSpeck = BigInt(body.perTxLimitSpeck as string);
    if (body.perUserTxLimit !== undefined) updateData.perUserTxLimit = body.perUserTxLimit;
    if (body.epochDurationSeconds !== undefined) updateData.epochDurationSeconds = body.epochDurationSeconds;
    if (body.allowedContracts !== undefined) updateData.allowedContracts = body.allowedContracts;
    if (body.allowedEntryPoints !== undefined) updateData.allowedEntryPoints = body.allowedEntryPoints;
    if (body.startTime !== undefined) updateData.startTime = new Date(body.startTime as string);
    if (body.endTime !== undefined) updateData.endTime = body.endTime ? new Date(body.endTime as string) : null;
    if (body.cbWindowSeconds !== undefined) updateData.cbWindowSeconds = body.cbWindowSeconds;
    if (body.cbMaxSpeck !== undefined) updateData.cbMaxSpeck = BigInt(body.cbMaxSpeck as string);

    const updated = await updateCampaign(id, updateData as any);
    await writeAuditLog({ actorId: request.adminUser?.id, actorType: 'admin', action: 'campaign.update', targetType: 'campaign', targetId: id });
    return reply.send({ campaign: updated });
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

  app.delete('/v1/admin/campaigns/:id', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await deleteCampaign(id);
    if (!deleted) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    await writeAuditLog({ actorId: request.adminUser?.id, actorType: 'admin', action: 'campaign.delete', targetType: 'campaign', targetId: id });
    return reply.code(204).send();
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

  // ── Transactions ────────────────────────────────────────────────
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

  app.get('/v1/admin/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const tx = await getTransactionById(id);
    if (!tx) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Transaction not found' });
    }
    return reply.send({ transaction: tx });
  });

  // ── Admin Users ─────────────────────────────────────────────────
  app.get('/v1/admin/users', { onRequest: [requireAdminRole('admin')] }, async (_request, reply) => {
    const users = await listAdminUsers();
    return reply.send({ users });
  });

  app.post('/v1/admin/users', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const body = request.body as { email: string; password: string; name?: string; role?: 'admin' | 'viewer' };
    if (!body.email || !body.password) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'email and password required' });
    }
    const user = await createAdminUser(body);
    await writeAuditLog({ actorId: request.adminUser?.id, actorType: 'admin', action: 'user.create', targetType: 'admin_user', targetId: user.id, metadata: { email: body.email } });
    return reply.code(201).send({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  app.delete('/v1/admin/users/:id', { onRequest: [requireAdminRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === request.adminUser?.id) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Cannot delete yourself' });
    }
    const deleted = await deleteAdminUser(id);
    if (!deleted) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'User not found' });
    }
    await writeAuditLog({ actorId: request.adminUser?.id, actorType: 'admin', action: 'user.delete', targetType: 'admin_user', targetId: id });
    return reply.code(204).send();
  });

  // ── Overview ────────────────────────────────────────────────────
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

  // ── Wallet ──────────────────────────────────────────────────────
  app.get('/v1/admin/wallet/balance', async (request, reply) => {
    const { sponsorWallet } = request.server as any;
    if (!sponsorWallet) {
      return reply.send({ balance: '0', address: null, connected: false });
    }
    try {
      const balance = await sponsorWallet.getDustBalance();
      const address = sponsorWallet.getCoinPublicKey?.() ?? null;
      return reply.send({ balance: balance.toString(), address, connected: true });
    } catch {
      return reply.send({ balance: '0', address: null, connected: false });
    }
  });
}
