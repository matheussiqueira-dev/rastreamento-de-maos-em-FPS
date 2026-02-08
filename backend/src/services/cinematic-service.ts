import { GoogleGenAI } from '@google/genai';
import { AppError } from '../shared/app-error.js';

export type CinematicAspectRatio = '16:9' | '9:16';

export interface CinematicGenerationInput {
  prompt: string;
  aspectRatio: CinematicAspectRatio;
  image: {
    base64: string;
    mimeType: string;
  };
}

export interface CinematicGenerationResult {
  videoBase64: string;
  mimeType: string;
  aspectRatio: CinematicAspectRatio;
  prompt: string;
}

export interface CinematicService {
  generate(input: CinematicGenerationInput): Promise<CinematicGenerationResult>;
}

const DEFAULT_MODEL = 'veo-3.1-fast-generate-preview';
const POLL_INTERVAL_MS = 4500;
const MAX_WAIT_MS = 4 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const joinKeyToUri = (uri: string, apiKey: string) =>
  `${uri}${uri.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`;

export class GeminiCinematicService implements CinematicService {
  private readonly ai: GoogleGenAI;

  constructor(private readonly apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(input: CinematicGenerationInput): Promise<CinematicGenerationResult> {
    let operation = await this.ai.models.generateVideos({
      model: DEFAULT_MODEL,
      prompt: input.prompt,
      image: {
        imageBytes: input.image.base64,
        mimeType: input.image.mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: input.aspectRatio,
      },
    });

    const startedAt = Date.now();
    while (!operation.done) {
      if (Date.now() - startedAt > MAX_WAIT_MS) {
        throw new AppError(
          'Tempo limite na geração cinematográfica. Tente novamente com outro prompt.',
          504,
          'INTERNAL_ERROR',
        );
      }

      await sleep(POLL_INTERVAL_MS);
      operation = await this.ai.operations.getVideosOperation({ operation });
    }

    const downloadUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadUri) {
      throw new AppError('A geração foi concluída sem retorno de vídeo.', 502, 'INTERNAL_ERROR');
    }

    const response = await fetch(joinKeyToUri(downloadUri, this.apiKey));
    if (!response.ok) {
      throw new AppError('Falha no download do vídeo gerado.', 502, 'INTERNAL_ERROR');
    }

    const mimeType = response.headers.get('content-type') ?? 'video/mp4';
    const payload = Buffer.from(await response.arrayBuffer()).toString('base64');

    return {
      videoBase64: payload,
      mimeType,
      aspectRatio: input.aspectRatio,
      prompt: input.prompt,
    };
  }
}
