import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '../client.js';
import { usageLedger, campaigns } from '../schema/index.js';
import type { UsageLedger } from '@aetherdust/policy-engine';

export class PostgresUsageLedger implements UsageLedger {
  async spentTodaySpeck(campaignId: string): Promise<bigint> {
    const db = getDb();
    const result = await db.execute<Record<string, unknown>>(sql`
      SELECT COALESCE(SUM(${usageLedger.feeSpeck}::numeric), 0) AS total
      FROM ${usageLedger}
      WHERE ${usageLedger.campaignId} = ${campaignId}
        AND ${usageLedger.recordedAt} >= date_trunc('day', now())
    `);
    return BigInt(String(result.rows[0]?.total ?? '0'));
  }

  async usageCountThisEpoch(campaignId: string, usageId: string): Promise<number> {
    const db = getDb();
    const result = await db.execute<Record<string, unknown>>(sql`
      SELECT COUNT(*)::int AS cnt
      FROM ${usageLedger} u
      JOIN ${campaigns} c ON c.id = u.${usageLedger.campaignId}
      WHERE u.${usageLedger.campaignId} = ${campaignId}
        AND u.${usageLedger.usageId} = ${usageId}
        AND u.${usageLedger.recordedAt} >= now() - (c.${campaigns.epochDurationSeconds} || ' seconds')::interval
    `);
    return Number(result.rows[0]?.cnt ?? 0);
  }
}

export async function recordUsage(campaignId: string, usageId: string, feeSpeck: bigint): Promise<void> {
  const db = getDb();
  await db.insert(usageLedger).values({
    campaignId,
    usageId,
    feeSpeck: feeSpeck.toString(),
  });
}

export async function getDailySpend(campaignId: string, days?: number): Promise<{ day: string; total: string; count: number }[]> {
  const db = getDb();
  const limit = days ?? 30;
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      date_trunc('day', ${usageLedger.recordedAt})::text AS day,
      COALESCE(SUM(${usageLedger.feeSpeck}::numeric), 0)::text AS total,
      COUNT(*)::int AS count
    FROM ${usageLedger}
    WHERE ${usageLedger.campaignId} = ${campaignId}
      AND ${usageLedger.recordedAt} >= now() - interval '1 day' * ${limit}
    GROUP BY date_trunc('day', ${usageLedger.recordedAt})
    ORDER BY day DESC
  `);
  return result.rows as { day: string; total: string; count: number }[];
}
