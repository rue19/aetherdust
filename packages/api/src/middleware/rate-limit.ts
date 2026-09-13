import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetMs: number;
}

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 60_000;

let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetMs < now) store.delete(key);
  }
}

export function rateLimitMiddleware(maxRequests: number, windowMs: number) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    cleanup();
    const apiKey = request.apiKey;
    if (!apiKey) return;

    const key = `${apiKey.projectId}:${apiKey.keyPrefix}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetMs < now) {
      store.set(key, { count: 1, resetMs: now + windowMs });
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetMs - now) / 1000);
      reply.header('Retry-After', retryAfter);
      return reply.code(429).send({
        error: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${retryAfter}s`,
        retryAfter,
      });
    }
  };
}
