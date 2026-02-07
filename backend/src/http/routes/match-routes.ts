import { FastifyInstance } from 'fastify';
import { StoreRepository } from '../../infrastructure/store/store-repository.js';
import { MatchService } from '../../services/match-service.js';
import {
  leaderboardQuerySchema,
  matchSubmissionSchema,
  paginationSchema,
  summaryQuerySchema,
} from '../../domain/schemas.js';
import { AppError } from '../../shared/app-error.js';
import { validate } from '../../shared/validate.js';
import { requireAuth } from '../auth-guard.js';

interface MatchRoutesDeps {
  repository: StoreRepository;
  matchService: MatchService;
}

export const registerMatchRoutes = async (app: FastifyInstance, deps: MatchRoutesDeps) => {
  app.post('/matches', { preHandler: requireAuth }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) throw new AppError('Usuário não autenticado.', 401, 'UNAUTHORIZED');
    const payload = validate(matchSubmissionSchema, request.body);
    const match = await deps.matchService.submitMatch(auth.sub, payload);
    reply.code(201).send({ match });
  });

  app.get('/matches/me', { preHandler: requireAuth }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError('Usuário não autenticado.', 401, 'UNAUTHORIZED');
    const query = validate(paginationSchema, request.query);
    const matches = await deps.repository.listMatchesByUser(auth.sub, query.limit);
    return { matches };
  });

  app.get('/matches/summary', { preHandler: requireAuth }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError('Usuário não autenticado.', 401, 'UNAUTHORIZED');
    const query = validate(summaryQuerySchema, request.query);
    const summary = await deps.repository.getMatchSummary(auth.sub, query.days);
    return { summary };
  });

  app.get('/leaderboard', async (request) => {
    const query = validate(leaderboardQuerySchema, request.query);
    const leaderboard = await deps.repository.getLeaderboard(query);
    return { leaderboard };
  });
};
