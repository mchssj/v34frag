import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/types';
import type { Config } from '../env';

export type Db = SupabaseClient<Database>;

// El backend nunca guarda sesión: cada request trae su token.
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

/**
 * Cliente con la clave pública y sin sesión. Sirve para login, registro y refresh.
 * Es uno nuevo cada vez porque esas operaciones guardan la sesión en memoria del cliente.
 */
// La IP real del usuario (replanteo 149): Caddy la pasa a la base desde X-Forwarded-For cuando el pedido viene del
// propio VPS, y la base la usa para el baneo por IP y para registrar las IPs de las cuentas.
const ipHeaders = (ip?: string): Record<string, string> => (ip ? { 'X-Forwarded-For': ip } : {});

export const anonClient = (cfg: Config, ip?: string): Db =>
  createClient<Database>(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { ...options, global: { headers: ipHeaders(ip) } });

/** Cliente que actúa como el usuario: PostgREST, RPC y Storage aplican sus RLS. */
export const userClient = (cfg: Config, token: string, ip?: string): Db =>
  createClient<Database>(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}`, ...ipHeaders(ip) } },
  });

/**
 * Cliente con la clave de administrador: se salta las RLS. Solo para las acciones de cuenta de los admins (plan
 * docs/bitacora/2026-11-03-admin-cuentas-usuarios), siempre detrás de requireAdmin. Null si la clave no está configurada.
 */
export const serviceClient = (cfg: Config): Db | null =>
  cfg.SUPABASE_SERVICE_KEY ? createClient<Database>(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_KEY, options) : null;

// Para validar tokens se reutiliza un cliente por configuración: guarda en caché las claves
// públicas (JWKS) y así cada request se valida sin ir a Supabase. Nunca se le inicia sesión.
const verifiers = new WeakMap<Config, Db>();
export function verifierClient(cfg: Config): Db {
  let c = verifiers.get(cfg);
  if (!c) verifiers.set(cfg, (c = anonClient(cfg)));
  return c;
}
