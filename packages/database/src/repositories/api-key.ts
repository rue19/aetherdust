import { eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { apiKeys } from '../schema/index.js';
import { randomBytes, createHash } from 'crypto';

export interface ApiKeyRecord {
  id: string;
  projectId: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  rateLimitRps: number;
  enabled: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `ad_live_${raw}`;
  const hash = hashKey(key);
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export async function createApiKey(data: {
  projectId: string;
  name: string;
  scopes?: string[];
  rateLimitRps?: number;
  expiresAt?: Date;
}): Promise<ApiKeyRecord & { plaintextKey: string }> {
  const db = getDb();
  const { key, hash, prefix } = generateApiKey();

  const rows = await db.insert(apiKeys).values({
    projectId: data.projectId,
    keyHash: hash,
    keyPrefix: prefix,
    name: data.name,
    scopes: data.scopes ?? ['sponsor'],
    rateLimitRps: data.rateLimitRps ?? 10,
    expiresAt: data.expiresAt ?? null,
  }).returning();

  return {
    id: rows[0].id,
    projectId: rows[0].projectId,
    keyPrefix: rows[0].keyPrefix,
    name: rows[0].name,
    scopes: rows[0].scopes ?? ['sponsor'],
    rateLimitRps: rows[0].rateLimitRps,
    enabled: rows[0].enabled,
    lastUsedAt: rows[0].lastUsedAt,
    createdAt: rows[0].createdAt,
    expiresAt: rows[0].expiresAt,
    plaintextKey: key,
  };
}

export async function verifyApiKey(plaintextKey: string): Promise<ApiKeyRecord | null> {
  const db = getDb();
  const hash = hashKey(plaintextKey);
  const rows = await db.select().from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  if (!row.enabled) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));

  return {
    id: row.id,
    projectId: row.projectId,
    keyPrefix: row.keyPrefix,
    name: row.name,
    scopes: row.scopes ?? ['sponsor'],
    rateLimitRps: row.rateLimitRps,
    enabled: row.enabled,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.update(apiKeys).set({ enabled: false }).where(eq(apiKeys.id, id)).returning();
  return rows.length > 0;
}

export async function listApiKeys(projectId: string): Promise<ApiKeyRecord[]> {
  const db = getDb();
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.projectId, projectId));
  return rows.map(row => ({
    id: row.id,
    projectId: row.projectId,
    keyPrefix: row.keyPrefix,
    name: row.name,
    scopes: row.scopes ?? ['sponsor'],
    rateLimitRps: row.rateLimitRps,
    enabled: row.enabled,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  }));
}
