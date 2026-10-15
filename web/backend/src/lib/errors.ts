import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import type { AppEnv } from './types';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMITED'
  | 'INVALID_FILE'
  | 'FILE_TOO_LARGE'
  | 'CONFIG_INVALID'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const validationError = (error: z.ZodError) =>
  new AppError(
    400,
    'VALIDATION_ERROR',
    'Los datos enviados no son válidos.',
    error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );

// Error que devuelven PostgREST / supabase-js.
export interface PostgrestLikeError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

export function fromPostgrest(err: PostgrestLikeError): AppError {
  const code = err.code ?? '';
  switch (code) {
    case 'PGRST301': // JWT inválido
    case 'PGRST303': // JWT vencido
      return new AppError(401, 'UNAUTHORIZED', 'La sesión no es válida o venció.');
    case '42501': // RLS o permiso denegado
      return new AppError(403, 'FORBIDDEN', 'No tienes permiso para hacer esto.');
    case 'PGRST116': // .single() sin filas
      return new AppError(404, 'NOT_FOUND', 'No se encontró lo que buscas.');
    case '23505':
      return new AppError(409, 'CONFLICT', 'Ya existe un registro igual.');
    case '23503':
      return new AppError(400, 'VALIDATION_ERROR', 'Hace referencia a algo que no existe.');
    case '23514':
      return new AppError(400, 'VALIDATION_ERROR', 'Algún dato no cumple las reglas de la base.');
    case 'P0001': // raise exception de una función SQL: el mensaje es para el usuario
      return new AppError(400, 'BUSINESS_RULE', err.message);
  }
  if (code.startsWith('22')) return new AppError(400, 'VALIDATION_ERROR', 'Algún dato tiene un formato inválido.');
  return new AppError(500, 'INTERNAL', 'Error interno.', undefined);
}

// Error de Supabase Auth (AuthApiError y compañía): `code` es el error_code de GoTrue.
export interface AuthLikeError {
  code?: string | undefined;
  status?: number | undefined;
  message: string;
}

export function fromAuthError(err: AuthLikeError): AppError {
  switch (err.code) {
    case 'invalid_credentials':
      return new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos.');
    case 'email_not_confirmed':
      return new AppError(403, 'EMAIL_NOT_CONFIRMED', 'Confirma tu email antes de iniciar sesión (revisa tu correo).');
    case 'user_already_exists':
    case 'email_exists':
      return new AppError(409, 'CONFLICT', 'Ya hay una cuenta con ese email.');
    case 'weak_password':
      return new AppError(400, 'VALIDATION_ERROR', 'La contraseña es demasiado débil.');
    case 'email_address_invalid':
      return new AppError(400, 'VALIDATION_ERROR', 'El email no es válido.');
    case 'validation_failed':
      return new AppError(400, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AppError(429, 'RATE_LIMITED', 'Demasiados intentos. Espera un momento y vuelve a probar.');
    case 'signup_disabled':
      return new AppError(403, 'FORBIDDEN', 'El registro está deshabilitado.');
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
    case 'session_not_found':
    case 'session_expired':
    case 'bad_jwt':
      return new AppError(401, 'UNAUTHORIZED', 'La sesión no es válida o venció. Inicia sesión de nuevo.');
  }
  if (err.status === 401 || err.status === 403) return new AppError(401, 'UNAUTHORIZED', 'La sesión no es válida o venció.');
  return new AppError(500, 'INTERNAL', 'Error interno.');
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'FILE_TOO_LARGE',
  429: 'RATE_LIMITED',
};

export function errorBody(c: Context<AppEnv>, code: ErrorCode, message: string, details?: unknown) {
  return {
    error: { code, message, ...(details === undefined ? {} : { details }), requestId: c.get('requestId') ?? null },
  };
}

export function onError(err: Error, c: Context<AppEnv>): Response {
  if (err instanceof AppError) {
    if (err.status >= 500) logError(c, err);
    return c.json(errorBody(c, err.code, err.message, err.details), err.status, err.headers);
  }
  if (err instanceof HTTPException) {
    const code = CODE_BY_STATUS[err.status] ?? 'INTERNAL';
    if (err.status >= 500) logError(c, err);
    return c.json(errorBody(c, code, err.message || 'Error.'), err.status as ContentfulStatusCode);
  }
  logError(c, err);
  return c.json(errorBody(c, 'INTERNAL', 'Error interno. Si se repite, avisa con el requestId.'), 500);
}

// Una línea JSON por error, para leerla con `wrangler tail`. Nunca incluye el cuerpo ni los headers.
export function logError(c: Context<AppEnv>, err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      level: 'error',
      requestId: c.get('requestId'),
      method: c.req.method,
      path: c.req.path,
      name: e.name,
      message: e.message,
      cause: e.cause instanceof Error ? e.cause.message : e.cause,
      stack: e.stack?.split('\n').slice(0, 6).join('\n'),
    }),
  );
}
