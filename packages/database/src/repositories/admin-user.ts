import { eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { adminUsers } from '../schema/index.js';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'viewer';
  createdAt: Date;
  lastLoginAt: Date | null;
}

export async function createAdminUser(data: {
  email: string;
  password: string;
  name?: string;
  role?: 'admin' | 'viewer';
}): Promise<AdminUserRecord> {
  const db = getDb();
  const hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const rows = await db.insert(adminUsers).values({
    email: data.email,
    passwordHash: hash,
    name: data.name ?? null,
    role: data.role ?? 'viewer',
  }).returning();
  return { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: rows[0].role, createdAt: rows[0].createdAt, lastLoginAt: rows[0].lastLoginAt };
}

export async function verifyAdminUser(email: string, password: string): Promise<AdminUserRecord | null> {
  const db = getDb();
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];

  const isLegacyHash = row.passwordHash.includes(':') && !row.passwordHash.startsWith('$2');

  if (isLegacyHash) {
    const { createHash } = await import('node:crypto');
    const [salt] = row.passwordHash.split(':');
    const legacyHash = createHash('sha256').update(`${salt}:${password}`).digest('hex');
    const legacyFull = `${salt}:${legacyHash}`;

    if (legacyFull !== row.passwordHash) return null;

    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db.update(adminUsers).set({ passwordHash: newHash, lastLoginAt: new Date() }).where(eq(adminUsers.id, row.id));

    return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.createdAt, lastLoginAt: new Date() };
  }

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) return null;

  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, row.id));
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.createdAt, lastLoginAt: new Date() };
}

export async function getAdminUserById(id: string): Promise<AdminUserRecord | null> {
  const db = getDb();
  const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (rows.length === 0) return null;
  return { id: rows[0].id, email: rows[0].email, name: rows[0].name, role: rows[0].role, createdAt: rows[0].createdAt, lastLoginAt: rows[0].lastLoginAt };
}
