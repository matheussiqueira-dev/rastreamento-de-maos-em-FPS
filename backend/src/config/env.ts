import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  BACKEND_HOST: z.string().default('0.0.0.0'),
  BACKEND_PORT: z.coerce.number().int().positive().default(8787),
  BACKEND_JWT_SECRET: z.string().min(12).default('gesturestrike-dev-secret-change-me'),
  BACKEND_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  BACKEND_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  BACKEND_RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  BACKEND_CORS_ORIGINS: z.string().default('http://localhost:3000'),
  BACKEND_DATA_FILE: z.string().default(path.resolve('backend/data/store.json')),
  BACKEND_ADMIN_EMAIL: z.string().email().optional(),
  BACKEND_ADMIN_PASSWORD: z.string().min(8).optional(),
});

export type AppConfig = {
  host: string;
  port: number;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  rateLimitMax: number;
  rateLimitWindow: string;
  corsOrigins: string[];
  dataFile: string;
  bootstrapAdmin?: { email: string; password: string };
};

export const loadConfig = (): AppConfig => {
  const parsed = envSchema.parse(process.env);
  const corsOrigins = parsed.BACKEND_CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean);

  const hasAdminBootstrap = Boolean(parsed.BACKEND_ADMIN_EMAIL && parsed.BACKEND_ADMIN_PASSWORD);
  const bootstrapAdmin = hasAdminBootstrap
    ? {
        email: parsed.BACKEND_ADMIN_EMAIL!,
        password: parsed.BACKEND_ADMIN_PASSWORD!,
      }
    : undefined;

  return {
    host: parsed.BACKEND_HOST,
    port: parsed.BACKEND_PORT,
    jwtSecret: parsed.BACKEND_JWT_SECRET,
    accessTokenTtlSeconds: parsed.BACKEND_ACCESS_TOKEN_TTL_SECONDS,
    rateLimitMax: parsed.BACKEND_RATE_LIMIT_MAX,
    rateLimitWindow: parsed.BACKEND_RATE_LIMIT_WINDOW,
    corsOrigins,
    dataFile: path.isAbsolute(parsed.BACKEND_DATA_FILE)
      ? parsed.BACKEND_DATA_FILE
      : path.resolve(parsed.BACKEND_DATA_FILE),
    bootstrapAdmin,
  };
};
