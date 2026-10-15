import path from 'node:path';
import { z } from 'zod';

const DEV_JWT_SECRET = 'gesturestrike-dev-secret-change-me';

// Variáveis vazias (ex.: `BACKEND_GEMINI_API_KEY=` copiado do .env.example) contam como ausentes.
const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  BACKEND_HOST: z.string().default('0.0.0.0'),
  BACKEND_PORT: z.coerce.number().int().positive().default(8787),
  BACKEND_JWT_SECRET: z.string().min(12).default(DEV_JWT_SECRET),
  BACKEND_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  BACKEND_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  BACKEND_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  BACKEND_CINEMATIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  BACKEND_CINEMATIC_RATE_LIMIT_WINDOW: z.string().default('1 hour'),
  BACKEND_TRUST_PROXY: booleanFlag,
  BACKEND_CORS_ORIGINS: z.string().default('http://localhost:3000'),
  BACKEND_DATA_FILE: z.string().default(path.resolve('backend/data/store.json')),
  BACKEND_GEMINI_API_KEY: optionalString(z.string().min(20)),
  BACKEND_ADMIN_EMAIL: optionalString(z.string().email()),
  BACKEND_ADMIN_PASSWORD: optionalString(z.string().min(8)),
});

export type AppConfig = {
  environment: 'development' | 'test' | 'production';
  host: string;
  port: number;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  rateLimitMax: number;
  rateLimitWindow: string;
  cinematicRateLimitMax: number;
  cinematicRateLimitWindow: string;
  trustProxy: boolean;
  corsOrigins: string[];
  dataFile: string;
  geminiApiKey?: string;
  bootstrapAdmin?: { email: string; password: string };
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = envSchema.parse(env);

  if (parsed.NODE_ENV === 'production' && parsed.BACKEND_JWT_SECRET === DEV_JWT_SECRET) {
    throw new Error('BACKEND_JWT_SECRET precisa ser definido em produção (o segredo padrão de desenvolvimento é público).');
  }

  const corsOrigins = parsed.BACKEND_CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);
  if (parsed.NODE_ENV === 'production' && corsOrigins.includes('*')) {
    throw new Error('BACKEND_CORS_ORIGINS não pode conter "*" em produção.');
  }

  const bootstrapAdmin =
    parsed.BACKEND_ADMIN_EMAIL && parsed.BACKEND_ADMIN_PASSWORD
      ? { email: parsed.BACKEND_ADMIN_EMAIL, password: parsed.BACKEND_ADMIN_PASSWORD }
      : undefined;

  return {
    environment: parsed.NODE_ENV,
    host: parsed.BACKEND_HOST,
    port: parsed.BACKEND_PORT,
    jwtSecret: parsed.BACKEND_JWT_SECRET,
    accessTokenTtlSeconds: parsed.BACKEND_ACCESS_TOKEN_TTL_SECONDS,
    rateLimitMax: parsed.BACKEND_RATE_LIMIT_MAX,
    rateLimitWindow: parsed.BACKEND_RATE_LIMIT_WINDOW,
    cinematicRateLimitMax: parsed.BACKEND_CINEMATIC_RATE_LIMIT_MAX,
    cinematicRateLimitWindow: parsed.BACKEND_CINEMATIC_RATE_LIMIT_WINDOW,
    trustProxy: parsed.BACKEND_TRUST_PROXY,
    corsOrigins,
    dataFile: path.isAbsolute(parsed.BACKEND_DATA_FILE)
      ? parsed.BACKEND_DATA_FILE
      : path.resolve(parsed.BACKEND_DATA_FILE),
    geminiApiKey: parsed.BACKEND_GEMINI_API_KEY?.trim(),
    bootstrapAdmin,
  };
};
