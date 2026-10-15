import { describe, expect, it } from 'vitest';
import { loadConfig } from './env.js';

describe('loadConfig', () => {
  it('trata variáveis vazias copiadas do .env.example como ausentes', () => {
    const config = loadConfig({ BACKEND_GEMINI_API_KEY: '', BACKEND_ADMIN_EMAIL: '', BACKEND_ADMIN_PASSWORD: '' });
    expect(config.geminiApiKey).toBeUndefined();
    expect(config.bootstrapAdmin).toBeUndefined();
  });

  it('recusa o segredo JWT padrão de desenvolvimento em produção', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/BACKEND_JWT_SECRET/);
  });

  it('recusa CORS curinga em produção', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', BACKEND_JWT_SECRET: 'a-real-production-secret', BACKEND_CORS_ORIGINS: '*' }),
    ).toThrow(/CORS/);
  });

  it('aceita uma configuração de produção válida', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      BACKEND_JWT_SECRET: 'a-real-production-secret',
      BACKEND_CORS_ORIGINS: 'https://app.example.com, https://www.example.com',
      BACKEND_TRUST_PROXY: 'true',
    });
    expect(config.corsOrigins).toEqual(['https://app.example.com', 'https://www.example.com']);
    expect(config.trustProxy).toBe(true);
  });
});
