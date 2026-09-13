import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../client.js';
import { campaigns } from '../schema/index.js';
import type { Campaign } from '@aetherdust/policy-engine';

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const db = getDb();
  const rows = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (rows.length === 0) return null;
  return rowToCampaign(rows[0]);
}

export async function listCampaigns(projectId: string, opts?: { enabled?: boolean; limit?: number; offset?: number }) {
  const db = getDb();
  const conditions = [eq(campaigns.projectId, projectId)];
  if (opts?.enabled !== undefined) conditions.push(eq(campaigns.enabled, opts.enabled));

  const rows = await db.select().from(campaigns)
    .where(and(...conditions))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);

  return rows.map(rowToCampaign);
}

export async function createCampaign(data: {
  projectId: string;
  name: string;
  dailyBudgetSpeck: bigint;
  perTxLimitSpeck: bigint;
  perUserTxLimit: number;
  epochDurationSeconds: number;
  allowedContracts: string[];
  allowedEntryPoints: string[];
  startTime: Date;
  endTime?: Date | null;
  cbWindowSeconds?: number;
  cbMaxSpeck?: bigint;
}): Promise<Campaign> {
  const db = getDb();
  const rows = await db.insert(campaigns).values({
    projectId: data.projectId,
    name: data.name,
    dailyBudgetSpeck: data.dailyBudgetSpeck.toString(),
    perTxLimitSpeck: data.perTxLimitSpeck.toString(),
    perUserTxLimit: data.perUserTxLimit,
    epochDurationSeconds: data.epochDurationSeconds,
    allowedContracts: data.allowedContracts,
    allowedEntryPoints: data.allowedEntryPoints,
    startTime: data.startTime,
    endTime: data.endTime ?? null,
    cbWindowSeconds: data.cbWindowSeconds ?? 60,
    cbMaxSpeck: (data.cbMaxSpeck ?? 40_000_000_000_000n).toString(),
  }).returning();
  return rowToCampaign(rows[0]);
}

export async function updateCampaign(id: string, data: Partial<{
  name: string;
  enabled: boolean;
  dailyBudgetSpeck: bigint;
  perTxLimitSpeck: bigint;
  perUserTxLimit: number;
  epochDurationSeconds: number;
  allowedContracts: string[];
  allowedEntryPoints: string[];
  startTime: Date;
  endTime: Date | null;
  cbWindowSeconds: number;
  cbMaxSpeck: bigint;
}>): Promise<Campaign | null> {
  const db = getDb();
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.dailyBudgetSpeck !== undefined) updateData.dailyBudgetSpeck = data.dailyBudgetSpeck.toString();
  if (data.perTxLimitSpeck !== undefined) updateData.perTxLimitSpeck = data.perTxLimitSpeck.toString();
  if (data.perUserTxLimit !== undefined) updateData.perUserTxLimit = data.perUserTxLimit;
  if (data.epochDurationSeconds !== undefined) updateData.epochDurationSeconds = data.epochDurationSeconds;
  if (data.allowedContracts !== undefined) updateData.allowedContracts = data.allowedContracts;
  if (data.allowedEntryPoints !== undefined) updateData.allowedEntryPoints = data.allowedEntryPoints;
  if (data.startTime !== undefined) updateData.startTime = data.startTime;
  if (data.endTime !== undefined) updateData.endTime = data.endTime;
  if (data.cbWindowSeconds !== undefined) updateData.cbWindowSeconds = data.cbWindowSeconds;
  if (data.cbMaxSpeck !== undefined) updateData.cbMaxSpeck = data.cbMaxSpeck.toString();

  const rows = await db.update(campaigns).set(updateData).where(eq(campaigns.id, id)).returning();
  if (rows.length === 0) return null;
  return rowToCampaign(rows[0]);
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.delete(campaigns).where(eq(campaigns.id, id)).returning();
  return rows.length > 0;
}

function rowToCampaign(row: typeof campaigns.$inferSelect): Campaign {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    enabled: row.enabled,
    dailyBudgetSpeck: BigInt(row.dailyBudgetSpeck),
    perTransactionLimitSpeck: BigInt(row.perTxLimitSpeck),
    perUserTransactionLimit: row.perUserTxLimit,
    epochDurationSeconds: row.epochDurationSeconds,
    allowedContracts: row.allowedContracts ?? [],
    allowedEntryPoints: row.allowedEntryPoints ?? [],
    startTime: row.startTime,
    endTime: row.endTime,
  };
}
