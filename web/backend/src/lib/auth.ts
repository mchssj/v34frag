import type { Context, MiddlewareHandler } from 'hono';
import { AppError, fromPostgrest } from './errors';
import { anonClient, userClient, verifierClient } from './supabase';
import type { AppEnv } from './types';

export type AuthUser = {
  id: string;
  email: string | null;
  token: string;
};

const unauthorized = (message: string) => new AppError(401, 'UNAUTHORIZED', message);

function bearer(header: string | undefined): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)$/.exec(header?.trim() ?? '');
  return m?.[1] ?? null;
}

/**
 * Exige un access_token válido de Supabase Auth y deja en el contexto:
 *   c.var.user  { id, email, token }
 *   c.var.sb    cliente de Supabase que actúa como ese usuario (aplican las RLS)
 * Con claves asimétricas (ES256, las del proyecto) la firma se valida en local con el JWKS.
 */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = bearer(c.req.header('Authorization'));
  if (!token) throw unauthorized('Falta el token de sesión (header Authorization: Bearer <access_token>).');
  await authenticate(c, token);
  await next();
};

/**
 * Rutas públicas: sin header actúan como anónimo (c.var.sb con la clave pública y sin c.var.user);
 * con un token válido, como el usuario. Un token inválido o vencido da 401, para que el frontend renueve.
 */
export const optionalUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header) {
    c.set('sb', anonClient(c.var.config));
  } else {
    const token = bearer(header);
    if (!token) throw unauthorized('El header Authorization tiene que ser Bearer <access_token>.');
    await authenticate(c, token);
  }
  await next();
};

/** El usuario de la sesión, o undefined en una ruta con optionalUser sin sesión. */
export const currentUser = (c: Context<AppEnv>): AuthUser | undefined => c.get('user') as AuthUser | undefined;

async function authenticate(c: Context<AppEnv>, token: string) {
  const cfg = c.var.config;
  const { data, error } = await verifierClient(cfg).auth.getClaims(token);
  const claims = data?.claims;
  // La clave pública (anon) también es un JWT válido: se exige un usuario autenticado.
  if (error || !claims || claims.role !== 'authenticated' || typeof claims.sub !== 'string' || !claims.sub) {
    throw unauthorized('La sesión no es válida o venció.');
  }
  c.set('user', { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null, token });
  c.set('sb', userClient(cfg, token));
}

/** Si el usuario es admin (lee profiles.role con su token). */
export async function isAdmin(c: Context<AppEnv>): Promise<boolean> {
  const user = currentUser(c);
  if (!user) return false;
  const { data, error } = await c.var.sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) throw fromPostgrest(error);
  return data?.role === 'admin';
}

/** Exige requireUser antes. Lee profiles.role con el token del usuario (la RLS deja leer el propio). */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.var.user;
  if (!user) throw new Error('requireAdmin se usó sin requireUser antes');
  if (!(await isAdmin(c))) throw new AppError(403, 'FORBIDDEN', 'Solo un administrador puede hacer esto.');
  await next();
};
