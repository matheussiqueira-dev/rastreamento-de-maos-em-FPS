import { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from '../../domain/schemas.js';
import { AuthService } from '../../services/auth-service.js';
import { requireAuth } from '../auth-guard.js';
import { AppError } from '../../shared/app-error.js';
import { validate } from '../../shared/validate.js';

interface AuthRoutesDeps {
  authService: AuthService;
}

export const registerAuthRoutes = async (app: FastifyInstance, deps: AuthRoutesDeps) => {
  app.post('/auth/register', async (request, reply) => {
    const payload = validate(registerSchema, request.body);
    const result = await deps.authService.register(payload);
    reply.code(201).send(result);
  });

  app.post('/auth/login', async (request) => {
    const payload = validate(loginSchema, request.body);
    return deps.authService.login(payload);
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError('Usuário não autenticado.', 401, 'UNAUTHORIZED');
    const user = await deps.authService.findPublicUser(auth.sub);
    if (!user) throw new AppError('Usuário não encontrado.', 404, 'NOT_FOUND');
    return { user };
  });
};
