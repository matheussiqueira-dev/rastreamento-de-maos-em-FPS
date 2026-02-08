# GestureStrike FPS - Plataforma Fullstack com Rastreamento de Mãos

Projeto fullstack para experiência FPS em navegador controlada por gestos de mão, com renderização 3D em tempo real, backend modular para autenticação/telemetria e geração cinematográfica via API segura no servidor.

## Visão Geral do Projeto

### Propósito
- oferecer um FPS experimental com interação natural por visão computacional
- permitir evolução contínua do produto com métricas de gameplay e arquitetura escalável
- manter padrão profissional de UX/UI, segurança e manutenção

### Público-alvo
- jogadores e entusiastas de experiências imersivas web
- times de produto e P&D em interfaces naturais (NUI)
- portfólio técnico para arquitetura fullstack moderna

### Objetivos de negócio
- reduzir fricção de onboarding
- aumentar retenção por qualidade de feedback e fluidez
- instrumentar telemetria para decisões de produto

## Arquitetura e Decisões Técnicas

### Estilo arquitetural
- frontend: React + TypeScript com separação por camadas (`components`, `domain`, `hooks`, `services`)
- backend: monólito modular em Fastify com fronteiras explícitas (`http`, `services`, `domain`, `infrastructure`, `shared`)
- persistência: JSON file store com escrita serializada e atômica (fallback simples para ambiente local)

### Princípios aplicados
- SOLID: separação de responsabilidades em serviços, rotas e infraestrutura
- DRY: validação e contratos centralizados
- Clean Architecture pragmática: regras no domínio/aplicação, transporte na camada HTTP

### Decisões relevantes
1. A API key do pipeline cinematográfico não fica mais no frontend.
   O cliente chama `POST /api/v1/cinematics/generate` e a chave é lida via `BACKEND_GEMINI_API_KEY`.
2. O estado principal do jogo foi extraído para a camada `domain` (`domain/game-state.ts`).
3. O menu inicial ganhou analytics local de sessões com recomendação de dificuldade baseada em histórico.
4. O backend agora trata JWT inválido como `401` consistente (sem vazar erro interno).
5. O `JsonFileStore` foi reforçado com leitura imutável e fila de escrita serializada.

## Frontend (UX/UI)

### Melhorias aplicadas
- refatoração do `App.tsx` para reduzir acoplamento e centralização excessiva
- adição do `SessionInsightsPanel` com:
  - média de precisão/duração
  - melhor score
  - últimas sessões
  - recomendação automática de dificuldade
- evolução visual do design system com novos blocos de analytics e recomendação
- fluxo cinematográfico mais seguro, com feedback de status e cancelamento

### Acessibilidade e responsividade
- foco visível, `aria-live`, semântica de diálogo e navegação por teclado
- layout responsivo para desktop/tablet/mobile

## Backend (Lógica, Performance e Segurança)

### Melhorias aplicadas
- novo endpoint de geração cinematográfica:
  - `POST /api/v1/cinematics/generate`
  - validação estrita de prompt, aspect ratio e payload de imagem
- endurecimento de autenticação:
  - token inválido/expirado retorna `401` com código `UNAUTHORIZED`
- consistência de persistência:
  - escrita serializada com fila
  - leitura baseada em snapshot para evitar mutações externas

### Segurança adotada
- JWT para rotas protegidas
- autorização por papel (`PLAYER` / `ADMIN`)
- validação de entrada com Zod
- rate-limit, CORS controlado, Helmet
- hash de senha com bcrypt

## APIs, Dados e Integrações

### API versionada
- prefixo: `/api/v1`

### Endpoints principais
- Auth:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Profile:
  - `GET /profile/calibration`
  - `PUT /profile/calibration`
- Matches:
  - `POST /matches`
  - `GET /matches/me`
  - `GET /matches/summary`
  - `GET /leaderboard`
- Cinematics:
  - `POST /cinematics/generate`
- Admin:
  - `GET /admin/metrics`

### Contratos e documentação
- `backend/docs/openapi.yaml`
- `backend/docs/API_REFERENCE.md`

## Stack e Tecnologias

- Frontend: React 19, TypeScript, Vite, React Three Fiber, Drei, Three.js
- Tracking: MediaPipe Hands (via scripts CDN)
- Backend: Node.js 20+, Fastify, Zod, JWT, bcrypt, nanoid
- Testes: Vitest

## Estrutura do Projeto

```text
.
├── App.tsx
├── components/
├── config/
├── domain/
├── hooks/
├── services/
├── backend/
│   ├── docs/
│   └── src/
│       ├── config/
│       ├── domain/
│       ├── http/
│       ├── infrastructure/
│       ├── services/
│       └── shared/
└── docs/
```

## Instalação e Execução

### Pré-requisitos
- Node.js 20+
- npm 10+

### Instalação

```bash
npm install
```

### Variáveis de ambiente
Crie `.env` na raiz (ou use export no ambiente) com base em `backend/.env.example`.

Variáveis críticas:
- `BACKEND_JWT_SECRET`
- `BACKEND_CORS_ORIGINS`
- `BACKEND_DATA_FILE`
- `BACKEND_GEMINI_API_KEY` (necessária para endpoint cinematográfico)

Opcional frontend:
- `VITE_API_BASE_URL` (default: `http://localhost:8787/api/v1`)

### Desenvolvimento

```bash
# frontend
npm run dev

# backend (em outro terminal)
npm run dev:api
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:8787`

### Build

```bash
npm run build
```

### Testes

```bash
npm run test:api
```

### Typecheck

```bash
npm run typecheck
```

## Deploy (Diretrizes)

1. Definir segredos reais (`BACKEND_JWT_SECRET`, `BACKEND_GEMINI_API_KEY`).
2. Restringir `BACKEND_CORS_ORIGINS` para domínios oficiais.
3. Executar `npm run build` em CI.
4. Publicar frontend estático e backend Node separadamente.
5. Monitorar logs, taxa de erro e latência de geração cinematográfica.

## Boas Práticas Adotadas

- contratos de entrada/saída com validação centralizada
- tratamento de erro padronizado
- separação de camadas e responsabilidades
- persistência com escrita atômica e serialização de operações
- cobertura de testes para fluxos críticos de API

## Evolução do Produto (Próximos Passos)

1. Migrar persistência para PostgreSQL com repositórios transacionais.
2. Adicionar autenticação completa no frontend (login/cadastro + sessão).
3. Persistir analytics de sessão em backend para dashboards históricos.
4. Implementar observabilidade com OpenTelemetry + Prometheus.
5. Adicionar suíte E2E de UX crítica (onboarding, gameplay, modais).

---

Autoria: Matheus Siqueira  
Website: https://www.matheussiqueira.dev/
