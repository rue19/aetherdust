import { eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { projects } from '../schema/index.js';

export interface ProjectRecord {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export async function createProject(data: { name: string; ownerId: string }): Promise<ProjectRecord> {
  const db = getDb();
  const rows = await db.insert(projects).values({ name: data.name, ownerId: data.ownerId }).returning();
  return { id: rows[0].id, name: rows[0].name, ownerId: rows[0].ownerId, createdAt: rows[0].createdAt };
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
  const db = getDb();
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (rows.length === 0) return null;
  return { id: rows[0].id, name: rows[0].name, ownerId: rows[0].ownerId, createdAt: rows[0].createdAt };
}

export async function listProjects(ownerId: string): Promise<ProjectRecord[]> {
  const db = getDb();
  const rows = await db.select().from(projects).where(eq(projects.ownerId, ownerId));
  return rows.map(r => ({ id: r.id, name: r.name, ownerId: r.ownerId, createdAt: r.createdAt }));
}
