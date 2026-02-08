import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { AppConfig } from './config/env.js';
import { CinematicService } from './services/cinematic-service.js';

const tempFiles: string[] = [];
const SAMPLE_IMAGE_BASE64 = Buffer.from('mock-image-payload').toString('base64');

const createConfig = async (): Promise<AppConfig> => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gesturestrike-api-'));
  const filePath = path.join(tempDirectory, 'store.json');
  tempFiles.push(tempDirectory);

  return {
    host: '127.0.0.1',
    port: 9876,
    jwtSecret: 'test-secret-very-safe',
    accessTokenTtlSeconds: 3600,
    rateLimitMax: 500,
    rateLimitWindow: '1 minute',
    corsOrigins: ['http://localhost:3000'],
    dataFile: filePath,
    geminiApiKey: undefined,
    bootstrapAdmin: undefined,
  };
};

afterEach(async () => {
  while (tempFiles.length) {
    const entry = tempFiles.pop();
    if (!entry) continue;
    await fs.rm(entry, { recursive: true, force: true });
  }
});

describe('GestureStrike Backend API', () => {
  it('registers, authenticates and returns user profile', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });
    await app.ready();

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'player@example.com',
        displayName: 'Player One',
        password: 'StrongPass1!',
      },
    });
    expect(register.statusCode).toBe(201);
    const registeredBody = register.json();
    expect(registeredBody.user.email).toBe('player@example.com');

    const me = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${registeredBody.accessToken}`,
      },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.displayName).toBe('Player One');

    await app.close();
  });

  it('submits matches and serves leaderboard/summary', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });
    await app.ready();

    const register = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'pilot@example.com',
        displayName: 'Pilot',
        password: 'StrongPass1!',
      },
    });
    const token = register.json().accessToken as string;

    const submitMatch = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        score: 12000,
        accuracy: 72.3,
        difficulty: 'TACTICAL',
        durationMs: 145000,
        kills: 31,
        highestWave: 6,
      },
    });
    expect(submitMatch.statusCode).toBe(201);

    const summary = await app.inject({
      method: 'GET',
      url: '/api/v1/matches/summary?days=30',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().summary.totalMatches).toBe(1);

    const leaderboard = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboard?limit=10',
    });
    expect(leaderboard.statusCode).toBe(200);
    expect(leaderboard.json().leaderboard.length).toBe(1);

    await app.close();
  });

  it('rejects protected routes without token', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/matches/me',
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('rejects invalid JWT with 401 and does not leak internal errors', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer invalid-token' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe('UNAUTHORIZED');
    await app.close();
  });

  it('returns 503 for cinematic generation when server key is not configured', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cinematics/generate',
      payload: {
        prompt: 'Sequência tática com câmera orbital e luz volumétrica intensa.',
        aspectRatio: '16:9',
        image: {
          base64: SAMPLE_IMAGE_BASE64,
          mimeType: 'image/png',
        },
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().code).toBe('SERVICE_UNAVAILABLE');
    await app.close();
  });

  it('generates cinematic payload with mocked service', async () => {
    const cinematicService: CinematicService = {
      async generate(input) {
        expect(input.aspectRatio).toBe('9:16');
        return {
          videoBase64: Buffer.from('fake-video').toString('base64'),
          mimeType: 'video/mp4',
          aspectRatio: input.aspectRatio,
          prompt: input.prompt,
        };
      },
    };

    const app = await buildApp({
      config: await createConfig(),
      logger: false,
      cinematicService,
    });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cinematics/generate',
      payload: {
        prompt: 'Movimento suave em ambiente noturno com tensão crescente e foco no alvo.',
        aspectRatio: '9:16',
        image: {
          base64: SAMPLE_IMAGE_BASE64,
          mimeType: 'image/jpeg',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().video.mimeType).toBe('video/mp4');
    expect(response.json().meta.aspectRatio).toBe('9:16');
    await app.close();
  });
});
