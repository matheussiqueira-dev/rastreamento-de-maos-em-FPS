# API Reference (v1)

Base URL: `http://localhost:8787/api/v1`

Auth:

- Header `Authorization: Bearer <token>` para endpoints protegidos.

## Status

- `GET /health`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (protegido)

## Profile

- `GET /profile/calibration` (protegido)
- `PUT /profile/calibration` (protegido)

## Matches

- `POST /matches` (protegido)
- `GET /matches/me?limit=20` (protegido)
- `GET /matches/summary?days=30` (protegido)
- `GET /leaderboard?limit=20&difficulty=TACTICAL&days=30`

## Cinematics

- `POST /cinematics/generate`
  - body:
    - `prompt: string (12..340)`
    - `aspectRatio: "16:9" | "9:16"`
    - `image.base64: string`
    - `image.mimeType: image/png|image/jpeg|image/jpg|image/webp`
  - resposta:
    - `video.base64: string`
    - `video.mimeType: string`
    - `meta.generatedAt: string`

## Admin

- `GET /admin/metrics` (protegido, role `ADMIN`)

## Contrato de erro

Todas as respostas de erro seguem o mesmo formato, inclusive erros do próprio framework:

```json
{ "error": "AppError", "message": "Dados de entrada inválidos.", "code": "VALIDATION_ERROR", "details": null }
```

| Código | Status | Quando |
|---|---|---|
| `BAD_REQUEST` | 400 | JSON malformado, requisição inválida |
| `UNAUTHORIZED` | 401 | Token ausente, inválido ou expirado; credenciais incorretas |
| `FORBIDDEN` | 403 | Papel sem permissão (ex.: rotas de admin) |
| `NOT_FOUND` | 404 | Endpoint ou recurso inexistente |
| `CONFLICT` | 409 | E-mail já cadastrado |
| `PAYLOAD_TOO_LARGE` | 413 | Corpo acima do limite da rota |
| `VALIDATION_ERROR` | 422 | Falha de validação (`details` traz os campos) |
| `RATE_LIMITED` | 429 | Limite global ou da rota de cinemática excedido |
| `INTERNAL_ERROR` | 500 | Falha inesperada (a mensagem original nunca é exposta) |
| `UPSTREAM_ERROR` | 502 | Falha no provedor de vídeo |
| `SERVICE_UNAVAILABLE` | 503 | Cinemática sem `BACKEND_GEMINI_API_KEY` configurada |
| `TIMEOUT` | 504 | Geração de vídeo excedeu o tempo limite |

Dificuldades aceitas em partidas e no leaderboard: `EASY`, `CASUAL`, `TACTICAL`, `INSANE`.
