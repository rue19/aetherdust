import { eq, desc } from 'drizzle-orm';
import { getDb } from '../client.js';
import { auditLog } from '../schema/index.js';

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorType: 'admin' | 'api_key' | 'system';
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export async function writeAuditLog(data: {
  actorId?: string;
  actorType: 'admin' | 'api_key' | 'system';
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.insert(auditLog).values({
    actorId: data.actorId ?? null,
    actorType: data.actorType,
    action: data.action,
    targetType: data.targetType ?? null,
    targetId: data.targetId ?? null,
    metadata: data.metadata ?? null,
  });
}

export async function listAuditLog(opts: {
  actorId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> {
  const db = getDb();
  const query = db.select().from(auditLog);
  const rows = await query.orderBy(desc(auditLog.createdAt)).limit(opts.limit ?? 50).offset(opts.offset ?? 0);
  return rows.map(row => ({
    id: row.id,
    actorId: row.actorId,
    actorType: row.actorType as AuditLogEntry['actorType'],
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt,
  }));
}
