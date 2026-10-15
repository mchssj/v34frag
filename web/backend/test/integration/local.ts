import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

// Datos de la Supabase LOCAL (npm run db:start). Nunca apunta a producción.
type Status = { API_URL: string; ANON_KEY: string; SERVICE_ROLE_KEY: string };

let status: Status | undefined;
export function local(): Status {
  if (!status) {
    let out: string;
    try {
      out = execSync('npx --no-install supabase status -o json', { cwd: new URL('../..', import.meta.url), stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      throw new Error('La Supabase local no está corriendo: npm run db:start');
    }
    status = JSON.parse(out) as Status;
    if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error(`No es una Supabase local: ${status.API_URL}`);
  }
  return status;
}

export const localEnv = (over: Record<string, string> = {}) => ({
  APP_ENV: 'test',
  SUPABASE_URL: local().API_URL,
  SUPABASE_ANON_KEY: local().ANON_KEY,
  CORS_ORIGINS: 'http://localhost:*',
  FRONTEND_URL: 'http://localhost:5173',
  GIT_SHA: 'test',
  ...over,
});

// Cliente con service_role de la base local: solo para preparar datos de prueba.
export const admin = () =>
  createClient(local().API_URL, local().SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Crea un usuario confirmado, inicia sesión y devuelve su id y access_token. */
export async function createUser(opts: { tag?: string; role?: 'admin' | 'user' } = {}) {
  const email = `t-${unique()}@test.local`;
  const password = 'clave-de-prueba-123';
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { tag: opts.tag ?? `T${unique().slice(0, 8)}` },
  });
  if (error || !data.user) throw error ?? new Error('createUser sin usuario');
  if (opts.role === 'admin') {
    const r = await a.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
    if (r.error) throw r.error;
  }
  const anon = createClient(local().API_URL, local().ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await anon.auth.signInWithPassword({ email, password });
  if (s.error || !s.data.session) throw s.error ?? new Error('login sin sesión');
  return { id: data.user.id, email, password, token: s.data.session.access_token, refresh: s.data.session.refresh_token };
}
