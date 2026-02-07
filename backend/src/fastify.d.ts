import '@fastify/jwt';
import 'fastify';
import { AuthTokenPayload } from './domain/types.js';

declare module 'fastify' {
  interface FastifyInstance {
    runtimeMetrics: {
      apiRequests: number;
      startedAt: string;
    };
  }

  interface FastifyRequest {
    auth: AuthTokenPayload | null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    user: AuthTokenPayload;
  }
}
