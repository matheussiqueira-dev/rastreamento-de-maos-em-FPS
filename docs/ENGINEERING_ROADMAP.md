# GestureStrike — Documento Master de Evolução

> Auditoria técnica, correções aplicadas e roteiro para levar o projeto de protótipo a produto.
> Branch de referência: `feat/enterprise-hardening` (3 commits sobre `main`).

**Legenda usada em todo o documento**

| Marca | Significado |
|---|---|
| ✅ **Aplicado** | Implementado neste ciclo, coberto por teste automatizado ou verificado no navegador |
| 🧭 **Proposto** | Recomendação com guia de implementação; ainda não aplicada |

---

## 1. Sumário executivo

**O que o projeto é hoje.** Um FPS em navegador controlado por gestos (MediaPipe Hands + React Three Fiber) com um backend Fastify modular (auth JWT, partidas, leaderboard, calibração, geração de vídeo via Gemini/Veo). A base é bem organizada para um projeto deste porte: camadas `domain`/`services`/`http`/`infrastructure` no backend, reducer puro para o estado do jogo, validação com Zod e TypeScript `strict` nos dois lados.

**O que a auditoria encontrou.** Além de dívidas esperadas em protótipos, defeitos reais — todos **reproduzidos antes de corrigidos**:

| # | Defeito | Impacto | Status |
|---|---|---|---|
| 1 | Error handler registrado depois das rotas: a API usava o handler padrão do Fastify | **Mensagens internas de erros 500 vazavam ao cliente** (ex.: detalhes do provedor de IA) | ✅ |
| 2 | Checagem de e-mail fora da fila de escrita | 2 cadastros simultâneos → **2 contas com o mesmo e-mail** (ambos 201) | ✅ |
| 3 | Origem CORS não autorizada lançava exceção | Requisição virava **500 INTERNAL_ERROR** | ✅ |
| 4 | Backend não conhecia a dificuldade `EASY` | Partidas no nível "Muito Fácil" (o **padrão** do frontend) → **422** | ✅ |
| 5 | Limite de corpo padrão (1 MB) na rota de vídeo | Imagens acima de ~750 KB rejeitadas com 413, apesar do frontend aceitar 4 MB | ✅ |
| 6 | "Iniciar missão" apagava o erro de câmera sem tentar de novo | **Sem webcam, o jogo travava** em "Iniciando câmera..." enquanto inimigos atacavam | ✅ |
| 7 | Câmera do jogador não girava | Inimigos nascem em 360°, mas só era possível atirar para frente | ✅ (teclado) |
| 8 | Scripts do MediaPipe sem versão (`latest`) no CDN | Atualização upstream poderia quebrar o jogo ou servir código diferente | ✅ |

**Resultado mensurável deste ciclo**

| Métrica | Antes | Depois |
|---|---|---|
| Testes automatizados | 6 (só backend) | **33** (16 frontend + 17 backend) |
| Testes de regressão para defeitos confirmados | 0 | 7 |
| Pipeline de CI | inexistente | GitHub Actions: typecheck, testes, build (Node 20 e 22), `npm audit` |
| Vulnerabilidades (`npm audit`) | 25 (4 críticas) | **0** |
| Jogável sem câmera | não | **sim** (modo teclado/mouse com fallback automático) |

**A maior lacuna de produto (proposta central).** O frontend **não usa** o backend de contas, partidas e leaderboard — só o endpoint de vídeo. Todo o histórico vive no `localStorage` do navegador. O backend existe, está testado e agora está endurecido, mas nenhum jogador o alcança. Conectar os dois (seção 4.1) é o passo de maior retorno: transforma uma demo isolada em um produto com contas, ranking global e retenção.

---

## 2. Skills ativadas e racional

Skills são pacotes de instruções especializadas que carrego sob demanda. Ativei apenas as que se aplicavam aos problemas encontrados no diagnóstico — não uma lista genérica.

| Skill | Por que foi ativada | Onde impactou a entrega |
|---|---|---|
| `ultrapowers-dev:auth-security` | O diagnóstico apontou riscos em auth (corrida no cadastro), segredos (JWT padrão aceito em produção) e exposição de dados (vazamento em erros 500) | Defeitos 1–3; recusa de segredo/CORS inseguros em produção; rate limit dedicado ao endpoint pago; seção 4.4 (tokens) |
| `ultrapowers-dev:ci-cd` | O repositório não tinha nenhuma verificação automática; correções sem CI regridem | `.github/workflows/ci.yml`: fail-fast por estágio, cache de dependências, cancelamento de execuções obsoletas, matriz de Node |
| `browser-automation` | O painel de navegador do ambiente estava em segundo plano (0 FPS), o que impedia validar o loop 3D | Validação real da jogabilidade em Chromium headless: movimento, disparo, recarga, giro, pausa — com 0 erros de console |

Capacidades usadas sem skill dedicada: leitura integral do código (≈5,8 mil linhas), testes de sonda para reproduzir cada defeito antes de corrigi-lo, e escrita técnica deste documento.

---

## 3. Melhorias aplicadas (✅)

### 3.1 Backend — contrato de erro, segurança e configuração

- **Contrato de erro único.** Handlers registrados antes do plugin de rotas; erros do próprio framework (JSON inválido, payload grande, rate limit) preservam o status 4xx e seguem o formato `{ error, message, code, details }`. Novos códigos: `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `TIMEOUT`.
- **Unicidade atômica de e-mail** dentro da fila de escrita do store.
- **Configuração segura por padrão** (`backend/src/config/env.ts`): `NODE_ENV=production` recusa o segredo JWT público de desenvolvimento e CORS `*`; variáveis vazias do `.env.example` passam a contar como ausentes (antes, copiar o exemplo derrubava o backend na inicialização).
- **Rate limit por rota** para `/cinematics/generate` (padrão 5/hora/IP): cada chamada consome cota paga do provedor.
- **Proxy-aware:** `BACKEND_TRUST_PROXY`; em produção nenhum IP fica isento de rate limit (antes `127.0.0.1` era isento — atrás de um proxy reverso, *todo* o tráfego chegaria como `127.0.0.1`).
- **Encerramento gracioso** (SIGINT/SIGTERM) para não perder gravações em deploys.
- Contrato de dificuldade com fonte única (`DIFFICULTY_LEVELS`), leaderboard com lookup O(1) por usuário, health check com uptime.

### 3.2 Frontend — demo jogável por qualquer pessoa

- **Modo de controle** no menu: *Gestos (câmera)* ou *Teclado e mouse*. Falha de câmera ativa o teclado automaticamente, com aviso e botão "Tentar câmera novamente" (remonta o rastreador, sem recarregar a página).
- **Entrada desacoplada do motor:** `domain/keyboard-input.ts` converte teclas no mesmo contrato `HandState` produzido pelo rastreador. O motor 3D não sabe de onde vem a intenção — o mesmo padrão permite adicionar gamepad ou toque.
- **Giro de câmera** (`Q`/`E` ou setas), pausa automática durante o modal de cinemática, rótulos de strafe corrigidos, mensagens de câmera em português, versões do MediaPipe fixadas.

### 3.3 Qualidade e entrega

- 16 testes unitários do domínio do frontend (intenção de teclado, reducer, analytics) e 11 novos testes de backend (regressões + configuração).
- CI no GitHub Actions; `npm test` roda as duas suítes.

---

## 4. Roadmap proposto (🧭) — com guias táticos

Ordenado por retorno sobre esforço. Estimativas assumem uma pessoa familiarizada com o código.

### 4.1 Conectar o frontend ao backend: contas, ranking global e sync de calibração
**Esforço:** 3–5 dias · **Valor:** alto (é o que transforma a demo em produto)

*Justificativa de negócio:* hoje cada jogador é anônimo e o progresso some ao trocar de navegador. Ranking global é o principal gatilho de retorno em jogos casuais e dá ao portfólio uma história fullstack completa, ponta a ponta.

*Como implementar:*
1. Em `services/api-client.ts`, um `request<T>()` genérico que valida respostas com Zod (o frontend hoje faz cast direto do JSON).
2. Um `AuthProvider` (React context) com `login`, `register`, `logout`, `user`. Jogar continua possível sem conta — a conta é um *upgrade*, não uma barreira.
3. No game over, se autenticado, `POST /matches` com o snapshot que já é montado em `App.tsx` (o backend agora aceita `EASY`).
4. Tela de leaderboard consumindo `GET /leaderboard?difficulty=&days=`.
5. Calibração: ler `GET /profile/calibration` no login e salvar com debounce em `PUT`.

```ts
// services/api-client.ts — base proposta
import { z } from 'zod';

const apiErrorSchema = z.object({ message: z.string(), code: z.string() });

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

export const request = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit & { token?: string } = {},
): Promise<T> => {
  const { token, headers, ...rest } = init;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new ApiError(parsed.success ? parsed.data.message : 'Falha de comunicação.', response.status,
      parsed.success ? parsed.data.code : 'UNKNOWN');
  }
  return schema.parse(body);
};
```

### 4.2 Validação de plausibilidade de partidas (anti-cheat básico)
**Esforço:** 1 dia · **Valor:** alto assim que 4.1 existir

*Problema:* a pontuação é calculada no cliente e enviada pronta; qualquer pessoa pode fazer `POST /matches` com `score: 5000000`. Com ranking público, isso destrói a credibilidade do produto no primeiro dia.

*Como implementar:* mover a fórmula de pontuação para um módulo compartilhado e recalcular o teto no servidor. Bloco proposto para `backend/src/services/match-service.ts`:

```ts
// Espelha a fórmula do cliente (components/GameContainer.tsx): 320 * multiplicador * (1 + (onda-1) * 0.18).
const SCORE_MULTIPLIER: Record<DifficultyLevel, number> = { EASY: 0.5, CASUAL: 1, TACTICAL: 1.3, INSANE: 1.7 };
const MIN_MS_PER_KILL = 240; // cooldown da arma: nenhum abate pode ser mais rápido que um disparo
const KILLS_PER_WAVE = 6;

export const assertPlausibleMatch = (match: MatchInput) => {
  const maxPerKill = 320 * SCORE_MULTIPLIER[match.difficulty] * (1 + (match.highestWave - 1) * 0.18);
  const maxScore = Math.ceil(match.kills * maxPerKill);
  const reachableWave = Math.floor(match.kills / KILLS_PER_WAVE) + 1;
  if (
    match.score > maxScore ||
    match.kills * MIN_MS_PER_KILL > match.durationMs ||
    match.highestWave > reachableWave
  ) {
    throw new AppError('Partida rejeitada por inconsistência.', 422, 'VALIDATION_ERROR');
  }
};
```

O próximo nível (servidor autoritativo de sessão, com `matchId` emitido no início e eventos assinados) só se justifica com ranking competitivo de verdade.

### 4.3 Persistência: do arquivo JSON para PostgreSQL
**Esforço:** 2–3 dias · **Valor:** pré-requisito para qualquer deploy com mais de uma instância

*Limitação atual (documentada, não é bug):* o `JsonFileStore` mantém todo o estado em memória e serializa escritas *dentro de um processo*. Duas instâncias corromperiam o arquivo; todo leaderboard é calculado varrendo todas as partidas; o arquivo regrava inteiro a cada escrita.

*Como implementar:* o `StoreRepository` já é a fronteira certa — basta uma segunda implementação.
1. Extrair `interface UserRepository / MatchRepository` a partir dos métodos públicos atuais.
2. Implementar com **Drizzle ORM** (leve, SQL-first, tipagem forte) sobre PostgreSQL (Neon ou Render têm planos gratuitos).
3. Unicidade de e-mail vira `UNIQUE INDEX` (a correção 3.1 passa a ser garantida pelo banco).
4. Índices: `matches (difficulty, score DESC)`, `matches (user_id, created_at DESC)`.
5. Leaderboard com `DISTINCT ON (user_id)` / window function em vez de agregação em memória.
6. Manter o `JsonFileStore` para testes e desenvolvimento offline.

### 4.4 Tokens: cookie httpOnly + refresh token
**Esforço:** 1–2 dias · **Valor:** médio-alto quando houver contas reais

Ao implementar 4.1, **não** guardar o JWT em `localStorage` (acessível a qualquer XSS). Usar access token curto (10–15 min) e refresh token em cookie `httpOnly; Secure; SameSite=Strict`, com rotação e revogação no banco (`@fastify/cookie`). Exigir autenticação também em `/cinematics/generate` — hoje o endpoint pago é público, mitigado só pelo rate limit.

### 4.5 Geração cinematográfica assíncrona
**Esforço:** 2 dias · **Valor:** médio (robustez e custo)

Hoje uma única requisição HTTP fica aberta por até 4 minutos e devolve o vídeo em base64 dentro do JSON (+33% de tamanho, tudo em memória no servidor). Proposta: `POST /cinematics` → `202 { jobId }`; `GET /cinematics/:id` → status; vídeo salvo em object storage (S3/R2/Vercel Blob) e servido por URL assinada. Sobrevive a reinícios, permite retomar e limita a concorrência por usuário.

### 4.6 Performance de carregamento
**Esforço:** 1 dia · **Valor:** médio (primeira impressão da demo)

Medido no build atual: `vendor-three` com **1,14 MB** (322 KB gzip) e `<Environment preset="night">`, que baixa um HDR de CDN externo em tempo de execução.
- Trocar o `Environment` por luz ambiente + hemisférica (a cena já é escura; o ganho visual do HDR é marginal) ou servir o HDR localmente.
- Importar só os helpers usados do `drei` e conferir o tree-shaking com `rollup-plugin-visualizer`.
- Carregar o MediaPipe só quando o modo *Gestos* for escolhido (hoje os scripts carregam sempre, mesmo no modo teclado).
- Meta: menu interativo em < 2 s em 4G.

### 4.7 Observabilidade
**Esforço:** 1 dia

`request-id` propagado em logs e respostas de erro; métricas de latência por rota e taxa de erro (OpenTelemetry ou `fastify-metrics` → Prometheus); Sentry no frontend para falhas de WebGL/câmera, que hoje só aparecem no console do usuário. As métricas operacionais do store (`metrics.apiRequests`) nunca são incrementadas — o contador real fica só em memória; unificar.

### 4.8 Testes E2E e deploy
**Esforço:** 2 dias

- Commitar o roteiro de QA usado nesta auditoria como suíte **Playwright** (`e2e/keyboard-mode.spec.ts`): menu → fallback sem câmera → movimento, disparo, recarga, pausa. Rodar no CI contra `vite preview`.
- `Dockerfile` multi-stage para o backend (`node:22-alpine`, usuário não-root, `HEALTHCHECK` em `/api/v1/health`).
- Frontend estático na Vercel (com preview por PR) e backend em container (Render/Fly). Variáveis documentadas em `backend/.env.example`.

### 4.9 Paridade de gestos
**Esforço:** 2–3 dias, exige testes com câmera real

O giro de câmera existe só no teclado. Proposta: inclinação lateral da mão de movimento (ângulo pulso→dedo médio) controla o giro, com zona morta calibrável no `CalibrationPanel`. Precisa de sessões de teste com usuários reais — não deve ser ajustado às cegas.

---

## 5. Visão de produto e posicionamento

**Reposicionamento recomendado:** de "FPS por gestos" para **"engine de entrada por gestos para a web, com um FPS como vitrine"**. O ativo mais reutilizável do projeto não é o jogo; é o pipeline câmera → landmarks → gesto estável (com suavização e calibração) → intenção de jogo, agora desacoplado do motor pelo contrato `HandState`.

Mercados onde esse ativo tem valor comprovado de uso:
- **Reabilitação e fisioterapia:** exercícios gamificados com medição de amplitude de movimento e relatórios para o profissional (o `SessionInsights` já é um embrião disso).
- **Acessibilidade:** controle de interfaces sem mouse/teclado.
- **Quiosques e ativações de marca:** interação sem toque em eventos e varejo.

*Features de alto valor, em ordem:* (1) contas + ranking global (4.1–4.2); (2) dashboard de evolução do jogador com histórico no servidor; (3) SDK de gestos extraído para pacote próprio (`@gesturestrike/input`) com documentação; (4) painel administrativo sobre `GET /admin/metrics` (já existe no backend, sem interface).

*O que **não** recomendo agora:* multiplayer em tempo real, microsserviços ou Kubernetes. Para o tamanho atual, um monólito modular bem testado é a arquitetura correta — e é exatamente o que um avaliador técnico experiente espera ver.

---

## 6. Blocos críticos já refatorados (✅ aplicados)

Trechos centrais das correções, por domínio. O código completo está nos commits da branch.

### 6.1 Backend · ordem dos handlers (`backend/src/app.ts`)

```ts
// Os handlers precisam ser registrados ANTES do plugin de rotas: no Fastify um contexto filho herda o
// error handler vigente no momento em que é criado.
app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) { /* contrato da aplicação */ }

  const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : 500;
  if (statusCode >= 400 && statusCode < 500) {
    reply.code(statusCode).send({ error: error.name, message: error.message,
      code: toErrorCode(statusCode), details: null });
    return;
  }

  app.log.error(error);
  reply.code(500).send({ error: 'Internal Server Error', message: 'Falha interna no servidor.',
    code: 'INTERNAL_ERROR', details: null });
});

await app.register(async (api) => { /* rotas /api/v1 */ }, { prefix: '/api/v1' });
```

### 6.2 Backend · unicidade atômica (`store-repository.ts` + `auth-service.ts`)

```ts
async createUserIfEmailAvailable(user: UserRecord): Promise<boolean> {
  return this.store.write((state) => {
    if (state.users.some((entry) => entry.email === user.email)) return false;
    state.users.push(user);
    return true;
  });
}

// auth-service.ts
const created = await this.repository.createUserIfEmailAvailable(user);
if (!created) throw new AppError('E-mail já cadastrado.', 409, 'CONFLICT');
```

### 6.3 Backend · configuração segura (`config/env.ts`)

```ts
if (parsed.NODE_ENV === 'production' && parsed.BACKEND_JWT_SECRET === DEV_JWT_SECRET) {
  throw new Error('BACKEND_JWT_SECRET precisa ser definido em produção.');
}
if (parsed.NODE_ENV === 'production' && corsOrigins.includes('*')) {
  throw new Error('BACKEND_CORS_ORIGINS não pode conter "*" em produção.');
}
```

### 6.4 Frontend · entrada agnóstica ao dispositivo (`domain/keyboard-input.ts`)

```ts
export const resolveKeyboardIntent = (pressed: ReadonlySet<string>): KeyboardIntent => {
  // ...teclas opostas se anulam; recarga > disparo > mira
  return {
    handState: { movement, combat, leftHandPresent: true, rightHandPresent: true },
    turn,
  };
};

// App.tsx — o motor recebe a intenção, não a fonte
const activeHandState = isKeyboardMode ? keyboardIntent.handState : handState;
```

### 6.5 Frontend · fallback de câmera (`App.tsx`)

```ts
const handleCameraError = useCallback((message: string) => {
  setCameraError(message);
  setInputMode('KEYBOARD');
  setHandState(DEFAULT_HAND_STATE);
  pushToast('info', 'Câmera indisponível', 'Modo teclado ativado: WASD move, Q/E gira, Espaço ou clique dispara.');
}, [pushToast, setInputMode]);
```

---

## 7. Validação deste ciclo e limites conhecidos

**Executado e aprovado:** `npm run typecheck`, `npm test` (33/33), `npm run build`, `npm audit` (0 vulnerabilidades), QA de jogabilidade em Chromium headless (fallback sem câmera, movimento, disparo por teclado e clique, recarga, giro, pausa na cinemática; 0 erros de console, 0 requisições com falha).

**Não validado:** jogabilidade por **gestos com câmera real** (indisponível no ambiente de teste). A inversão dos rótulos LEFT/RIGHT foi feita de forma a preservar o comportamento físico — o motor e o rastreador foram invertidos juntos —, mas merece um teste manual com webcam antes do merge. A geração cinematográfica real (Gemini/Veo) não foi chamada; os testes usam um serviço simulado.
