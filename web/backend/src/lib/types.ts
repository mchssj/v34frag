import type { RequestIdVariables } from 'hono/request-id';
import type { Config, RawEnv } from '../env';
import type { UdpExchange } from './a2s';
import type { AuthUser } from './auth';
import type { RateLimiter } from './ratelimit';
import type { Db } from './supabase';

// Tipo de Hono compartido por toda la app.
export type AppEnv = {
  Bindings: RawEnv;
  Variables: RequestIdVariables & {
    config: Config;
    rateLimiter: RateLimiter;
    // Envío UDP para A2S: solo en Node (node.ts). Sin él, /servers/status responde 501.
    udp: UdpExchange | undefined;
    // Solo existen en rutas con requireUser.
    user: AuthUser;
    sb: Db;
  };
};
