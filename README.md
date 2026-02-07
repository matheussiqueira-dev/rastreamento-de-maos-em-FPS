# GestureStrike Backend

Backend modular para o ecossistema GestureStrike, responsável por autenticação, ingestão de telemetria de partidas, gerenciamento de calibração e ranking global.

## Visão Geral do Backend

Domínio principal:

- autenticar jogadores e controlar acesso por papel (`PLAYER`, `ADMIN`)
- receber resultados de partidas de forma segura
- gerar métricas consolidadas para evolução de produto e gameplay
- armazenar preferências de calibração de rastreamento
- expor leaderboard para comparação entre jogadores

Regras de negócio implementadas:

- e-mail único por usuário
- senha forte obrigatória no cadastro
- endpoints protegidos por JWT
- validação rígida de payloads com limites de faixa
- controle de acesso por role no módulo administrativo

## Arquitetura Adotada

Arquitetura: **Monólito modular (modular monolith)** com separação por responsabilidade.

- `config`: carregamento e validação de ambiente
- `domain`: tipos e contratos de entrada
- `services`: regras de aplicação (auth/matches)
- `infrastructure`: persistência em arquivo JSON com escrita atômica
- `http`: camada de transporte, middlewares e rotas versionadas (`/api/v1`)
- `shared`: utilidades transversais (erros, validação)

Princípios aplicados:

- SOLID (especialmente SRP e DIP no desacoplamento de serviços/repositório)
- DRY (reuso de validação e erros)
- Clean Architecture pragmática (camadas com fronteiras claras)

## Tecnologias Utilizadas

- Node.js + TypeScript
- Fastify
- `@fastify/jwt`
- `@fastify/helmet`
- `@fastify/cors`
- `@fastify/rate-limit`
- Zod (validação de contratos)
- bcryptjs (hash de senha)
- nanoid (IDs)
- Vitest (testes de API)

## Segurança e Confiabilidade

Implementado:

- autenticação JWT para rotas protegidas
- autorização baseada em role (`ADMIN`)
- validação de entrada com Zod em todos os endpoints de negócio
- rate limiting global para mitigação de abuso
- headers de segurança via Helmet
- tratamento centralizado de erros com códigos padronizados
- hashing de senha com bcrypt
- CORS controlado por allowlist

Observações de segurança:

- CSRF mitigado por design: autenticação via header `Authorization` (sem cookie de sessão)
- SQLi reduzido por arquitetura atual (persistência JSON sem camada SQL)
- XSS mitigado no backend por resposta JSON estruturada e validação de payload

## API e Contratos

Versão de API:

- `v1` sob prefixo `/api/v1`

Principais endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `PUT /api/v1/profile/calibration`
- `GET /api/v1/profile/calibration`
- `POST /api/v1/matches`
- `GET /api/v1/matches/me`
- `GET /api/v1/matches/summary`
- `GET /api/v1/leaderboard`
- `GET /api/v1/admin/metrics` (admin)

Documentação de contrato:

- `backend/docs/openapi.yaml`
- `backend/docs/API_REFERENCE.md`

## Setup e Execução

## Pré-requisitos

- Node.js 20+

## Instalação

```bash
npm install
```

## Ambiente

Copie o arquivo de exemplo:

```bash
cp backend/.env.example .env
```

Variáveis críticas:

- `BACKEND_JWT_SECRET`
- `BACKEND_CORS_ORIGINS`
- `BACKEND_DATA_FILE`

## Executar backend (dev)

```bash
npm run dev:api
```

Servidor padrão:

- `http://localhost:8787`

Health check:

- `GET http://localhost:8787/api/v1/health`

## Build

```bash
npm run build:api
```

## Testes

```bash
npm run test:api
```

## Estrutura do Projeto (Backend)

```text
backend/
├── .env.example
├── docs/
│   ├── API_REFERENCE.md
│   └── openapi.yaml
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── fastify.d.ts
│   ├── config/
│   │   └── env.ts
│   ├── domain/
│   │   ├── schemas.ts
│   │   └── types.ts
│   ├── http/
│   │   ├── auth-guard.ts
│   │   └── routes/
│   │       ├── admin-routes.ts
│   │       ├── auth-routes.ts
│   │       ├── match-routes.ts
│   │       ├── profile-routes.ts
│   │       └── status-routes.ts
│   ├── infrastructure/
│   │   └── store/
│   │       ├── json-file-store.ts
│   │       └── store-repository.ts
│   ├── services/
│   │   ├── auth-service.ts
│   │   └── match-service.ts
│   └── shared/
│       ├── app-error.ts
│       └── validate.ts
├── tsconfig.json
└── vitest.config.ts
```

## Boas Práticas e Padrões

- validação de payload na borda da aplicação
- uso de DTOs tipados e erros padronizados
- separação entre regras de domínio e transporte HTTP
- persistência com escrita atômica para evitar corrupção de arquivo
- testes de integração por `inject` cobrindo fluxos críticos
- versionamento explícito de API para evolução sem quebra

## Novas Features Implementadas (Backend)

1. Módulo de autenticação e autorização JWT
- impacto: habilita controle de acesso seguro por perfil de usuário

2. Pipeline de ingestão de partidas + leaderboard
- impacto: permite análise de performance e ranking entre jogadores

3. Persistência de calibração por usuário
- impacto: melhora continuidade e personalização da experiência

4. Telemetria operacional administrativa
- impacto: aumenta observabilidade para manutenção em produção

## Melhorias Futuras

- migração de persistência JSON para PostgreSQL
- refresh tokens com rotação e lista de revogação
- auditoria de segurança com trilha de eventos
- métricas Prometheus + tracing OpenTelemetry
- CI/CD com quality gates (lint, test, coverage, SAST)
- documentação OpenAPI completa com schemas detalhados

---

Autoria: Matheus Siqueira  
Website: https://www.matheussiqueira.dev/
