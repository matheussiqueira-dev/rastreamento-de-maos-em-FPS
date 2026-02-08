import { FastifyInstance } from 'fastify';
import { cinematicGenerationSchema } from '../../domain/schemas.js';
import { AppError } from '../../shared/app-error.js';
import { validate } from '../../shared/validate.js';
import { CinematicService } from '../../services/cinematic-service.js';

interface CinematicRoutesDeps {
  cinematicService: CinematicService | null;
}

export const registerCinematicRoutes = async (app: FastifyInstance, deps: CinematicRoutesDeps) => {
  app.post('/cinematics/generate', async (request) => {
    if (!deps.cinematicService) {
      throw new AppError(
        'Serviço cinematográfico indisponível. Configure BACKEND_GEMINI_API_KEY no servidor.',
        503,
        'SERVICE_UNAVAILABLE',
      );
    }

    const payload = validate(cinematicGenerationSchema, request.body);
    const result = await deps.cinematicService.generate(payload);

    return {
      video: {
        base64: result.videoBase64,
        mimeType: result.mimeType,
      },
      meta: {
        aspectRatio: result.aspectRatio,
        prompt: result.prompt,
        generatedAt: new Date().toISOString(),
      },
    };
  });
};
