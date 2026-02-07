import { FastifyInstance } from 'fastify';
import { calibrationSchema } from '../../domain/schemas.js';
import { StoreRepository } from '../../infrastructure/store/store-repository.js';
import { AppError } from '../../shared/app-error.js';
import { validate } from '../../shared/validate.js';
import { requireAuth } from '../auth-guard.js';

interface ProfileRoutesDeps {
  repository: StoreRepository;
}

export const registerProfileRoutes = async (app: FastifyInstance, deps: ProfileRoutesDeps) => {
  app.get('/profile/calibration', { preHandler: requireAuth }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError('Usuário não autenticado.', 401, 'UNAUTHORIZED');
    const calibration = await deps.repository.getCalibration(auth.sub);
    return { calibration };
  });

  app.put('/profile/calibration', { preHandler: requireAuth }, async (request) => {
    const auth = request.auth;
    if (!auth) throw new AppError('Usuário não autenticado.', 401, 'UNAUTHORIZED');
    const payload = validate(calibrationSchema, request.body);
    const calibration = await deps.repository.upsertCalibration(auth.sub, payload);
    return { calibration };
  });
};
