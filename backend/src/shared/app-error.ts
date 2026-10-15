export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'UPSTREAM_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: ErrorCode, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const ensure = (condition: unknown, message: string, statusCode: number, code: ErrorCode) => {
  if (!condition) throw new AppError(message, statusCode, code);
};

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'BAD_REQUEST',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

export const toErrorCode = (statusCode: number): ErrorCode => STATUS_TO_CODE[statusCode] ?? 'BAD_REQUEST';
