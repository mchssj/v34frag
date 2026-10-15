import type { RequestIdVariables } from 'hono/request-id';
import type { Config, RawEnv } from '../env';
import type { AuthUser } from './auth';
import type { RateLimiter } from './ratelimit';
import type { Db } from './supabase';

// Tipo de Hono compartido por toda la app.
export type AppEnv = {
  Bindings: RawEnv;
  Variables: RequestIdVariables & {
    config: Config;
    rateLimiter: RateLimiter;
    // Solo existen en rutas con requireUser.
    user: AuthUser;
    sb: Db;
  };
};
