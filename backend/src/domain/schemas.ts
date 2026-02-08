import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'A senha deve conter ao menos 8 caracteres.')
  .max(72, 'A senha deve conter no máximo 72 caracteres.')
  .regex(/[A-Z]/, 'A senha deve conter ao menos 1 letra maiúscula.')
  .regex(/[a-z]/, 'A senha deve conter ao menos 1 letra minúscula.')
  .regex(/[0-9]/, 'A senha deve conter ao menos 1 número.')
  .regex(/[^A-Za-z0-9]/, 'A senha deve conter ao menos 1 caractere especial.');

export const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(50),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const calibrationSchema = z.object({
  movementCenterX: z.number().min(0).max(1),
  movementCenterY: z.number().min(0).max(1),
  movementDeadzone: z.number().min(0).max(1),
  fistStopThreshold: z.number().min(0).max(1),
  indexExtendedThreshold: z.number().min(0).max(1),
  fireCurlThreshold: z.number().min(0).max(1),
  openHandThreshold: z.number().min(0).max(1),
  smoothingFrames: z.number().int().min(1).max(10),
});

export const matchSubmissionSchema = z.object({
  score: z.number().int().min(0).max(5_000_000),
  accuracy: z.number().min(0).max(100),
  difficulty: z.enum(['CASUAL', 'TACTICAL', 'INSANE']),
  durationMs: z.number().int().min(1_000).max(3_600_000),
  kills: z.number().int().min(0).max(10_000),
  highestWave: z.number().int().min(1).max(10_000),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const leaderboardQuerySchema = paginationSchema.extend({
  difficulty: z.enum(['CASUAL', 'TACTICAL', 'INSANE']).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const summaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const imagePayloadSchema = z.object({
  base64: z
    .string()
    .min(1)
    .max(8_000_000)
    .regex(/^[A-Za-z0-9+/=]+$/, 'Imagem inválida em base64.'),
  mimeType: z
    .string()
    .regex(/^image\/(png|jpeg|jpg|webp)$/i, 'Formato de imagem não suportado.'),
});

export const cinematicGenerationSchema = z.object({
  prompt: z.string().min(12).max(340),
  aspectRatio: z.enum(['16:9', '9:16']),
  image: imagePayloadSchema,
});
