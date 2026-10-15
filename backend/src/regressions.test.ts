import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { AppConfig } from './config/env.js';
import { CinematicService } from './services/cinematic-service.js';

// Cada teste cobre um defeito confirmado na auditoria (docs/ENGINEERING_ROADMAP.md, seção 3).

const tempDirectories: string[] = [];
const PLAYER = { email: 'race@example.com', displayName: 'Racer', password: 'StrongPass1!' };
const CINEMATIC_PROMPT = 'Câmera orbital lenta sobre a arena com luz volumétrica.';

const createConfig = async (overrides: Partial<AppConfig> = {}): Promise<AppConfig> => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gesturestrike-regression-'));
  tempDirectories.push(tempDirectory);
  return {
    environment: 'test',
    host: '127.0.0.1',
    port: 0,
    jwtSecret: 'test-secret-very-safe',
    accessTokenTtlSeconds: 3600,
    rateLimitMax: 500,
    rateLimitWindow: '1 minute',
    cinematicRateLimitMax: 50,
    cinematicRateLimitWindow: '1 hour',
    trustProxy: false,
    corsOrigins: ['http://localhost:3000'],
    dataFile: path.join(tempDirectory, 'store.json'),
    ...overrides,
  };
};

const fakeCinematicService: CinematicService = {
  async generate(input) {
    return { videoBase64: 'AAAA', mimeType: 'video/mp4', aspectRatio: input.aspectRatio, prompt: input.prompt };
  },
};

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('regressões da auditoria', () => {
  it('não cria contas duplicadas em cadastros simultâneos com o mesmo e-mail', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });

    const responses = await Promise.all(
      [1, 2, 3].map(() => app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: PLAYER })),
    );

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409]);
    await app.close();
  });

  it('aceita partidas na dificuldade EASY (Muito Fácil), usada pelo frontend', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });

    const register = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: PLAYER });
    const token = register.json().accessToken as string;
    const match = await app.inject({
      method: 'POST',
      url: '/api/v1/matches',
      headers: { authorization: `Bearer ${token}` },
      payload: { score: 300, accuracy: 40, difficulty: 'EASY', durationMs: 60_000, kills: 2, highestWave: 1 },
    });
    expect(match.statusCode).toBe(201);

    const leaderboard = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?difficulty=EASY' });
    expect(leaderboard.json().leaderboard).toHaveLength(1);
    await app.close();
  });

  it('não responde 500 para origem CORS não autorizada', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });

    const blocked = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(blocked.statusCode).toBe(200);
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();

    const allowed = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    await app.close();
  });

  it('devolve erros do framework no contrato padrão da API, preservando o status 4xx', async () => {
    const app = await buildApp({ config: await createConfig(), logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{json-invalido',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'BAD_REQUEST', details: null });
    await app.close();
  });

  it('não vaza a mensagem original de erros internos (500) nas rotas da API', async () => {
    const app = await buildApp({
      config: await createConfig(),
      logger: false,
      cinematicService: {
        async generate() {
          throw new Error('detalhe interno do provedor: chave AIza... sem cota');
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cinematics/generate',
      payload: {
        prompt: CINEMATIC_PROMPT,
        aspectRatio: '16:9',
        image: { base64: Buffer.from('img').toString('base64'), mimeType: 'image/png' },
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Internal Server Error',
      message: 'Falha interna no servidor.',
      code: 'INTERNAL_ERROR',
      details: null,
    });
    expect(response.body).not.toContain('AIza');
    await app.close();
  });

  it('aceita imagens acima de 1 MB na geração cinematográfica', async () => {
    const app = await buildApp({
      config: await createConfig(),
      logger: false,
      cinematicService: fakeCinematicService,
    });

    const largeImage = Buffer.alloc(3 * 1024 * 1024, 7).toString('base64');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cinematics/generate',
      payload: {
        prompt: CINEMATIC_PROMPT,
        aspectRatio: '16:9',
        image: { base64: largeImage, mimeType: 'image/png' },
      },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('aplica rate limit próprio e mais restrito à geração cinematográfica', async () => {
    const app = await buildApp({
      config: await createConfig({ cinematicRateLimitMax: 2 }),
      logger: false,
      cinematicService: fakeCinematicService,
    });

    const generate = () =>
      app.inject({
        method: 'POST',
        url: '/api/v1/cinematics/generate',
        remoteAddress: '203.0.113.10',
        payload: {
          prompt: CINEMATIC_PROMPT,
          aspectRatio: '16:9',
          image: { base64: Buffer.from('img').toString('base64'), mimeType: 'image/png' },
        },
      });

    expect((await generate()).statusCode).toBe(200);
    expect((await generate()).statusCode).toBe(200);
    const limited = await generate();
    expect(limited.statusCode).toBe(429);
    expect(limited.json().code).toBe('RATE_LIMITED');
    await app.close();
  });
});
