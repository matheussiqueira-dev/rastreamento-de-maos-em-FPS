import { FastifyInstance } from 'fastify';
import { StoreRepository } from '../../infrastructure/store/store-repository.js';
import { requireRole } from '../auth-guard.js';

interface AdminRoutesDeps {
  repository: StoreRepository;
}

export const registerAdminRoutes = async (app: FastifyInstance, deps: AdminRoutesDeps) => {
  app.get('/admin/metrics', { preHandler: requireRole('ADMIN') }, async (request) => {
    const metrics = await deps.repository.getMetrics();
    const totals = await deps.repository.getTotals();
    const runtime = request.server.runtimeMetrics;
    const uptimeMs = Date.now() - Date.parse(runtime.startedAt);

    return {
      metrics,
      runtime: {
        apiRequests: runtime.apiRequests,
        startedAt: runtime.startedAt,
        uptimeMs,
      },
      totals,
      generatedAt: new Date().toISOString(),
    };
  });
};
