import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../shared/app-error.js';
import { AuthTokenPayload, UserRole } from '../domain/types.js';

const parseToken = (request: FastifyRequest) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new AppError('Token de autenticação ausente.', 401, 'UNAUTHORIZED');
  }
  return authorization.slice('Bearer '.length);
};

export const requireAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
  const token = parseToken(request);
  try {
    const payload = await request.server.jwt.verify<AuthTokenPayload>(token);
    request.auth = payload;
  } catch {
    throw new AppError('Token inválido ou expirado.', 401, 'UNAUTHORIZED');
  }
};

export const requireRole = (role: UserRole) => async (request: FastifyRequest, _reply: FastifyReply) => {
  await requireAuth(request, _reply);
  if (!request.auth || request.auth.role !== role) {
    throw new AppError('Acesso negado para este recurso.', 403, 'FORBIDDEN');
  }
};
