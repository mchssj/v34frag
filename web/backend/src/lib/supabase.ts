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
export const anonClient = (cfg: Config): Db => createClient<Database>(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, options);

/** Cliente que actúa como el usuario: PostgREST, RPC y Storage aplican sus RLS. */
export const userClient = (cfg: Config, token: string): Db =>
  createClient<Database>(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

// Para validar tokens se reutiliza un cliente por configuración: guarda en caché las claves
// públicas (JWKS) y así cada request se valida sin ir a Supabase. Nunca se le inicia sesión.
const verifiers = new WeakMap<Config, Db>();
export function verifierClient(cfg: Config): Db {
  let c = verifiers.get(cfg);
  if (!c) verifiers.set(cfg, (c = anonClient(cfg)));
  return c;
}
