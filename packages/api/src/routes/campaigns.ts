import type { FastifyInstance } from 'fastify';
import { getCampaignById, listCampaigns, createCampaign, updateCampaign, deleteCampaign } from '@aetherdust/database';
import { requireApiKey, requireScope } from '../middleware/auth.js';

export async function campaignRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requireApiKey);
  app.addHook('onRequest', requireScope('campaigns:read'));

  app.get('/v1/campaigns', async (request, reply) => {
    const projectId = request.apiKey!.projectId;
    const campaigns = await listCampaigns(projectId);
    return reply.send({ campaigns });
  });

  app.get('/v1/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await getCampaignById(id);
    if (!campaign || campaign.projectId !== request.apiKey!.projectId) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    return reply.send({ campaign });
  });

  app.post('/v1/campaigns', async (request, reply) => {
    const body = request.body as {
      name: string;
      dailyBudgetSpeck: string;
      perTxLimitSpeck: string;
      perUserTxLimit: number;
      epochDurationSeconds: number;
      allowedContracts: string[];
      allowedEntryPoints: string[];
      startTime: string;
      endTime?: string;
    };

    if (!body.name || !body.dailyBudgetSpeck || !body.perTxLimitSpeck) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', message: 'Missing required fields' });
    }

    const campaign = await createCampaign({
      projectId: request.apiKey!.projectId,
      name: body.name,
      dailyBudgetSpeck: BigInt(body.dailyBudgetSpeck),
      perTxLimitSpeck: BigInt(body.perTxLimitSpeck),
      perUserTxLimit: body.perUserTxLimit ?? 10,
      epochDurationSeconds: body.epochDurationSeconds ?? 86400,
      allowedContracts: body.allowedContracts ?? [],
      allowedEntryPoints: body.allowedEntryPoints ?? [],
      startTime: new Date(body.startTime),
      endTime: body.endTime ? new Date(body.endTime) : null,
    });

    return reply.code(201).send({ campaign });
  });

  app.put('/v1/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await getCampaignById(id);
    if (!existing || existing.projectId !== request.apiKey!.projectId) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }

    const body = request.body as Record<string, unknown>;
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

    const updated = await updateCampaign(id, updateData);
    return reply.send({ campaign: updated });
  });

  app.patch('/v1/campaigns/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await getCampaignById(id);
    if (!existing || existing.projectId !== request.apiKey!.projectId) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    const updated = await updateCampaign(id, { enabled: !existing.enabled });
    return reply.send({ campaign: updated });
  });

  app.delete('/v1/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await getCampaignById(id);
    if (!existing || existing.projectId !== request.apiKey!.projectId) {
      return reply.code(404).send({ error: 'NOT_FOUND', message: 'Campaign not found' });
    }
    await deleteCampaign(id);
    return reply.code(204).send();
  });
}
