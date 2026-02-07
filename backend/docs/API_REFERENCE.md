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

## Admin

- `GET /admin/metrics` (protegido, role `ADMIN`)
