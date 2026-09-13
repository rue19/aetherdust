import type { FastifyRequest, FastifyReply } from 'fastify';

const SUSPICIOUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /\$\{.*\}/,
  /\{\{.*\}\}/,
];

export async function sanitizeInput(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = request.body as Record<string, unknown> | undefined;
  if (!body) return;

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(value)) {
          return reply.code(400).send({
            error: 'INVALID_INPUT',
            message: `Potentially unsafe value in field "${key}"`,
          });
        }
      }
    }
  }
}
