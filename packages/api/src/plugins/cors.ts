import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export async function registerCors(app: FastifyInstance): Promise<void> {
  const origins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: origins && origins.length > 0 ? origins : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });
}
