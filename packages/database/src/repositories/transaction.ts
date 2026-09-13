import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '../client.js';
import { transactions } from '../schema/index.js';

export interface TransactionRecord {
  id: string;
  campaignId: string;
  status: 'pending' | 'sponsored' | 'rejected' | 'failed';
  rejectionReason: string | null;
  txHash: string | null;
  transactionHex: string;
  dustFeeSpeck: bigint;
  contractAddress: string | null;
  entryPoint: string | null;
  usageId: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestedAt: Date;
  processedAt: Date | null;
}

export async function createTransaction(data: {
  campaignId: string;
  status: 'pending' | 'sponsored' | 'rejected' | 'failed';
  transactionHex: string;
  dustFeeSpeck: bigint;
  contractAddress?: string;
  entryPoint?: string;
  usageId: string;
  ipAddress?: string;
  userAgent?: string;
  rejectionReason?: string;
  txHash?: string;
}): Promise<TransactionRecord> {
  const db = getDb();
  const rows = await db.insert(transactions).values({
    campaignId: data.campaignId,
    status: data.status,
    transactionHex: data.transactionHex,
    dustFeeSpeck: data.dustFeeSpeck.toString(),
    contractAddress: data.contractAddress ?? null,
    entryPoint: data.entryPoint ?? null,
    usageId: data.usageId,
    ipAddress: data.ipAddress ?? null,
    userAgent: data.userAgent ?? null,
    rejectionReason: data.rejectionReason ?? null,
    txHash: data.txHash ?? null,
    processedAt: data.status !== 'pending' ? new Date() : null,
  }).returning();
  return rowToRecord(rows[0]);
}

export async function updateTransaction(id: string, data: {
  status?: 'pending' | 'sponsored' | 'rejected' | 'failed';
  rejectionReason?: string;
  txHash?: string;
}): Promise<TransactionRecord | null> {
  const db = getDb();
  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status !== 'pending') updateData.processedAt = new Date();
  }
  if (data.rejectionReason !== undefined) updateData.rejectionReason = data.rejectionReason;
  if (data.txHash !== undefined) updateData.txHash = data.txHash;

  const rows = await db.update(transactions).set(updateData).where(eq(transactions.id, id)).returning();
  if (rows.length === 0) return null;
  return rowToRecord(rows[0]);
}

export async function getTransactionById(id: string): Promise<TransactionRecord | null> {
  const db = getDb();
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (rows.length === 0) return null;
  return rowToRecord(rows[0]);
}

export async function listTransactions(opts: {
  campaignId?: string;
  status?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}): Promise<TransactionRecord[]> {
  const db = getDb();
  const conditions = [];
  if (opts.campaignId) conditions.push(eq(transactions.campaignId, opts.campaignId));
  if (opts.status) conditions.push(eq(transactions.status, opts.status as any));

  const query = conditions.length > 0
    ? db.select().from(transactions).where(and(...conditions))
    : db.select().from(transactions);

  const rows = await query
    .orderBy(desc(transactions.requestedAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return rows.map(rowToRecord);
}

function rowToRecord(row: typeof transactions.$inferSelect): TransactionRecord {
  return {
    id: row.id,
    campaignId: row.campaignId,
    status: row.status as TransactionRecord['status'],
    rejectionReason: row.rejectionReason,
    txHash: row.txHash,
    transactionHex: row.transactionHex,
    dustFeeSpeck: BigInt(row.dustFeeSpeck),
    contractAddress: row.contractAddress,
    entryPoint: row.entryPoint,
    usageId: row.usageId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    requestedAt: row.requestedAt,
    processedAt: row.processedAt,
  };
}
