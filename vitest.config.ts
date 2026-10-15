import { defineConfig } from 'vitest/config';

// Testes unitários do frontend: regras puras da camada `domain` (sem DOM, sem WebGL).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['domain/**/*.test.ts'],
  },
});
