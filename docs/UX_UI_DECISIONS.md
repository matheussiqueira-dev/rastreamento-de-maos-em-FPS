# UX/UI Decisions - GestureStrike

## 1. Contexto e Objetivo

Produto: FPS web controlado por gestos com webcam.  
Objetivo de negócio: reduzir fricção de entrada, aumentar retenção de sessão e elevar percepção de qualidade.

Principais riscos de abandono identificados:

- onboarding inicial pouco guiado
- baixa previsibilidade de comandos para novos usuários
- ajustes de conforto/performance pouco visíveis

## 2. Melhorias de UX Aplicadas

### Fluxo inicial

- menu reestruturado em dois blocos: narrativa do produto + configuração da missão
- onboarding em 4 passos para reduzir ambiguidades de uso
- painel de insight da dificuldade selecionada com métricas operacionais

### Navegação e interação

- command bar contextual durante partida com atalhos explícitos (`C`, `V`, `H`, `P`)
- painel de ajuda com gestos e atalhos revisados
- presets de experiência:
  - `Preset competitivo`
  - `Preset conforto`

### Feedback e previsibilidade

- toasts de confirmação para mudanças de preferências
- rótulos e estados visuais reforçados para ações críticas

## 3. Melhorias de UI Aplicadas

- evolução do design system com tokens semânticos de cor, raio e espaçamento
- reforço de hierarquia visual em menu, cartões e blocos de telemetria
- padronização de botões com estados e variações (`primary`, `secondary`, `pill`, `ghost`)
- aplicação de chips de métrica e cartões de decisão para dificuldade

## 4. Design System (Tokens e Componentes)

Tokens principais adicionados/evoluídos:

- cores semânticas (`--accent`, `--danger`, `--success`, `--muted-strong`)
- escalas de espaçamento (`--space-1` até `--space-5`)
- raios de borda (`--radius-sm`, `--radius-md`, `--radius-lg`)

Componentes reutilizáveis consolidados:

- command bar
- cards de dificuldade
- insight card de dificuldade
- toasts UX
- painéis de ajuda/calibração/cinemática

## 5. Acessibilidade (WCAG)

Melhorias aplicadas:

- navegação por teclado com `skip-link`
- foco visível consistente (`:focus-visible`)
- reforço de atributos ARIA em diálogos e estados de progresso
- anúncios de estado via `aria-live`
- suporte a `prefers-reduced-motion`

## 6. Responsividade

Desktop:

- command bar superior direita
- layout de menu em duas colunas

Tablet/Mobile:

- command bar reposicionada para base
- menu em coluna única
- grupos de configuração e ações com botões full-width
- adaptação de grids de resultado e conteúdo auxiliar

## 7. Resultado Esperado

- menor tempo para primeira partida bem-sucedida
- maior compreensão de controles por novos usuários
- experiência mais confortável em dispositivos heterogêneos
- interface mais confiável e com percepção premium
