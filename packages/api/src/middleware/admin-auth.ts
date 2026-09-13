import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'changeme-set-JWT_SECRET-in-production';

export function signAdminToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export async function requireAdminAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'MISSING_TOKEN', message: 'Authorization header must be: Bearer <jwt_token>' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
    request.adminUser = decoded;
  } catch {
    return reply.code(401).send({ error: 'INVALID_TOKEN', message: 'Invalid or expired JWT token' });
  }
}

export function requireAdminRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.adminUser) {
      return reply.code(401).send({ error: 'MISSING_TOKEN', message: 'Admin authentication required' });
    }
    if (!roles.includes(request.adminUser.role)) {
      return reply.code(403).send({ error: 'INSUFFICIENT_ROLE', message: `Required roles: ${roles.join(', ')}` });
    }
  };
}
