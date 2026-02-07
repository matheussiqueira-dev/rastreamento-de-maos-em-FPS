import { ZodError, ZodType } from 'zod';
import { AppError } from './app-error.js';

export const validate = <T>(schema: ZodType<T>, input: unknown): T => {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError('Dados de entrada inválidos.', 422, 'VALIDATION_ERROR', error.flatten());
    }
    throw error;
  }
};
