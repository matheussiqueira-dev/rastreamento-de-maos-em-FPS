import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { AppConfig, loadConfig } from './config/env.js';
import { JsonFileStore } from './infrastructure/store/json-file-store.js';
import { StoreRepository } from './infrastructure/store/store-repository.js';
import { AuthService } from './services/auth-service.js';
import { MatchService } from './services/match-service.js';
import { registerAuthRoutes } from './http/routes/auth-routes.js';
import { registerProfileRoutes } from './http/routes/profile-routes.js';
import { registerMatchRoutes } from './http/routes/match-routes.js';
import { registerAdminRoutes } from './http/routes/admin-routes.js';
import { registerStatusRoutes } from './http/routes/status-routes.js';
import { registerCinematicRoutes } from './http/routes/cinematic-routes.js';
import { AppError, toErrorCode } from './shared/app-error.js';
import { CinematicService, GeminiCinematicService } from './services/cinematic-service.js';

interface BuildAppOptions {
  config?: AppConfig;
  logger?: boolean;
  cinematicService?: CinematicService | null;
}

export const buildApp = async (options?: BuildAppOptions) => {
  const config = options?.config ?? loadConfig();
  const app = Fastify({
    logger: options?.logger ?? true,
    // Atrás de proxy/load balancer, request.ip passa a refletir o cliente real (X-Forwarded-For),
    // o que é pré-requisito para o rate limit funcionar por usuário e não pelo IP do proxy.
    trustProxy: config.trustProxy,
  });

  app.decorate('runtimeMetrics', {
    apiRequests: 0,
    startedAt: new Date().toISOString(),
  });
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async () => {
    app.runtimeMetrics.apiRequests += 1;
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = config.corsOrigins.includes('*') || config.corsOrigins.includes(origin);
      // Origem não autorizada: responde sem cabeçalhos CORS (o navegador bloqueia a leitura).
      // Lançar erro aqui transformava a requisição em 500 INTERNAL_ERROR.
      return callback(null, isAllowed);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    // Em produção nenhum IP é isento: atrás de proxy reverso todo tráfego chegaria como 127.0.0.1.
    allowList: config.environment === 'production' ? [] : ['127.0.0.1'],
  });

  await app.register(jwt, { secret: config.jwtSecret });

  const store = new JsonFileStore(config.dataFile);
  await store.init();
  const repository = new StoreRepository(store);
  const authService = new AuthService(repository, app.jwt, config);
  const matchService = new MatchService(repository);
  const cinematicService =
    options?.cinematicService ?? (config.geminiApiKey ? new GeminiCinematicService(config.geminiApiKey) : null);

  if (config.bootstrapAdmin) {
    await authService.bootstrapAdmin(config.bootstrapAdmin.email, config.bootstrapAdmin.password);
    app.log.info({ email: config.bootstrapAdmin.email }, 'Admin bootstrap ensured.');
  }

  // Os handlers precisam ser registrados ANTES do plugin de rotas: no Fastify um contexto filho herda o
  // error handler vigente no momento em que é criado. Registrados depois, as rotas de /api/v1 usavam o
  // handler padrão, que devolvia a mensagem original de erros 500 ao cliente (vazamento de detalhes internos).
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: 'Endpoint não encontrado.',
      code: 'NOT_FOUND',
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: error.name,
        message: error.message,
        code: error.code,
        details: error.details ?? null,
      });
      return;
    }

    // Erros do próprio Fastify/plugins (JSON inválido, payload grande, rate limit...) já trazem
    // um status 4xx; preservamos o status e devolvemos o mesmo contrato de erro da API.
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500;
    if (statusCode >= 400 && statusCode < 500) {
      reply.code(statusCode).send({
        error: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : 'Requisição inválida.',
        code: toErrorCode(statusCode),
        details: null,
      });
      return;
    }

    app.log.error(error);
    reply.code(500).send({
      error: 'Internal Server Error',
      message: 'Falha interna no servidor.',
      code: 'INTERNAL_ERROR',
      details: null,
    });
  });

  await app.register(async (api) => {
    await registerStatusRoutes(api);
    await registerAuthRoutes(api, { authService });
    await registerProfileRoutes(api, { repository });
    await registerMatchRoutes(api, { repository, matchService });
    await registerAdminRoutes(api, { repository });
    await registerCinematicRoutes(api, {
      cinematicService,
      rateLimit: { max: config.cinematicRateLimitMax, timeWindow: config.cinematicRateLimitWindow },
    });
  }, { prefix: '/api/v1' });

  return app;
};
