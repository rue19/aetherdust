import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyApiKey, type ApiKeyRecord } from '@aetherdust/database';

export interface AuthenticatedKey {
  projectId: string;
  scopes: string[];
  keyPrefix: string;
  name: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: AuthenticatedKey;
    adminUser?: { id: string; email: string; role: string };
  }
}

export async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'MISSING_API_KEY', message: 'Authorization header must be: Bearer <api_key>' });
  }

  const plaintextKey = authHeader.slice(7);
  const record = await verifyApiKey(plaintextKey);
  if (!record) {
    return reply.code(401).send({ error: 'INVALID_API_KEY', message: 'Invalid or expired API key' });
  }

  request.apiKey = {
    projectId: record.projectId,
    scopes: record.scopes,
    keyPrefix: record.keyPrefix,
    name: record.name,
  };
}

export function requireScope(...requiredScopes: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.apiKey) {
      return reply.code(401).send({ error: 'MISSING_API_KEY', message: 'Authentication required' });
    }
    const hasAll = requiredScopes.every(s => request.apiKey!.scopes.includes(s));
    if (!hasAll) {
      return reply.code(403).send({ error: 'INSUFFICIENT_SCOPE', message: `Required scopes: ${requiredScopes.join(', ')}` });
    }
  };
}
