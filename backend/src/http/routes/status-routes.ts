import { FastifyInstance } from 'fastify';

export const registerStatusRoutes = async (app: FastifyInstance) => {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'gesturestrike-backend',
    now: new Date().toISOString(),
  }));
};
