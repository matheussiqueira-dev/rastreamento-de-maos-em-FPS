import { FastifyInstance } from 'fastify';

export const registerStatusRoutes = async (app: FastifyInstance) => {
  app.get('/health', async (request) => ({
    status: 'ok',
    service: 'gesturestrike-backend',
    uptimeMs: Date.now() - Date.parse(request.server.runtimeMetrics.startedAt),
    now: new Date().toISOString(),
  }));
};
