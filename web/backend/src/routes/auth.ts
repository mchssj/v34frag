import { createRoute } from '@hono/zod-openapi';
import type { Session as SbSession } from '@supabase/supabase-js';
import type { Context } from 'hono';
import type { Config } from '../env';
import { requireUser } from '../lib/auth';
import { inBackground } from '../lib/background';
import { AppError, fromAuthError, fromPostgrest, logError } from '../lib/errors';
import { RATE_RULES, rateLimit } from '../lib/ratelimit';
import { createRouter } from '../lib/router';
import { anonClient, userClient } from '../lib/supabase';
import type { AppEnv } from '../lib/types';
import {
  AuthUser,
  ForgotPasswordBody,
  ForgotPasswordResult,
  LoginBody,
  PasswordChangeBody,
  RefreshBody,
  ResetPasswordBody,
  Session,
  SignupBody,
  SignupResult,
  type SessionT,
} from '../schemas/auth';
import { toAuthUser } from '../services/account';
import { bearer, errorResponses, json } from '../schemas/common';


// ---------- helpers ----------

async function toSession(cfg: Config, s: SbSession): Promise<SessionT> {
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in,
    user: await toAuthUser(cfg, s.access_token, s.user),
  };
}

// Lo que hacía touchSeen() en la web: última conexión del usuario.
function touchLastSeen(c: Context<AppEnv>, token: string, id: string) {
  inBackground(
    c,
    (async () => {
      const { error } = await userClient(c.var.config, token)
        .from('profile_details')
        .upsert({ user_id: id, last_seen: new Date().toISOString() });
      if (error) throw new Error(`last_seen: ${error.code} ${error.message}`);
    })(),
  );
}

// Pone la contraseña con la sesión dada y cierra todas las demás. Lo usan el cambio y la recuperación.
async function setPassword(c: Context<AppEnv>, accessToken: string, password: string, sameMessage: string) {
  const cfg = c.var.config;
  const headers = { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const upd = await fetch(`${cfg.SUPABASE_URL}/auth/v1/user`, { method: 'PUT', headers, body: JSON.stringify({ password }) });
  if (!upd.ok) {
    const body = (await upd.json().catch(() => ({}))) as { code?: string; error_code?: string; msg?: string; message?: string };
    const code = body.error_code ?? body.code;
    if (code === 'same_password') throw new AppError(400, 'SAME_PASSWORD', sameMessage);
    if (code === 'weak_password') throw new AppError(400, 'VALIDATION_ERROR', body.msg ?? body.message ?? 'La contraseña es demasiado débil.', [{ path: 'new_password', message: 'Es demasiado débil.' }]);
    throw new AppError(500, 'INTERNAL', 'No se pudo cambiar la contraseña.');
  }
  // Todas las demás sesiones (otras PCs, el celular, la que hizo el pedido) dejan de valer; queda solo esta.
  const out = await fetch(`${cfg.SUPABASE_URL}/auth/v1/logout?scope=others`, { method: 'POST', headers });
  if (!out.ok) logError(c, new Error(`logout de las otras sesiones tras cambiar la contraseña: HTTP ${out.status}`));
}

// Errores de verifyOtp que significan "este link no sirve": vencido, ya usado o mal copiado.
const INVALID_LINK_CODES = new Set(['otp_expired', 'otp_disabled', 'invalid_credentials', 'validation_failed']);

// ---------- rutas ----------

const signup = createRoute({
  method: 'post',
  path: '/auth/signup',
  tags: ['Auth'],
  summary: 'Crear una cuenta',
  description:
    'Registra la cuenta en Supabase Auth con el tag como alias (`409` si está tomado). Si el proyecto pide confirmar el email, ' +
    'devuelve `session: null` y `needsConfirmation: true`: el usuario recibe un correo con un link al frontend.',
  middleware: [rateLimit(RATE_RULES.auth)] as const,
  request: { body: { required: true, ...json(SignupBody) } },
  responses: {
    201: { description: 'Cuenta creada', ...json(SignupResult) },
    ...errorResponses(400, 409, 429),
  },
});

const login = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: ['Auth'],
  summary: 'Iniciar sesión',
  middleware: [rateLimit(RATE_RULES.auth)] as const,
  request: { body: { required: true, ...json(LoginBody) } },
  responses: {
    200: { description: 'Sesión iniciada', ...json(Session) },
    ...errorResponses(400, 401, 403, 429),
  },
});

const refresh = createRoute({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Auth'],
  summary: 'Renovar la sesión',
  description: 'Canjea el refresh_token por una sesión nueva. El refresh_token usado deja de servir.',
  request: { body: { required: true, ...json(RefreshBody) } },
  responses: {
    200: { description: 'Sesión renovada', ...json(Session) },
    ...errorResponses(400, 401),
  },
});

const logout = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: ['Auth'],
  summary: 'Cerrar sesión',
  description: 'Invalida el refresh_token de esta sesión. El access_token sigue valiendo hasta que vence (1 hora).',
  security: bearer,
  middleware: [requireUser] as const,
  responses: {
    204: { description: 'Sesión cerrada' },
    ...errorResponses(401),
  },
});

const changePassword = createRoute({
  method: 'post',
  path: '/api/v1/me/password',
  tags: ['Mi perfil'],
  summary: 'Cambiar mi contraseña',
  description:
    'Pide la contraseña actual. Cierra todas las demás sesiones de la cuenta (otras PCs, el celular) y también la que hizo el ' +
    'pedido: devuelve una sesión nueva, que el frontend tiene que guardar en lugar de la anterior. ' +
    '`400 WRONG_PASSWORD` si la actual no es correcta y `400 SAME_PASSWORD` si la nueva es igual. Hasta 5 intentos por minuto.',
  security: bearer,
  middleware: [requireUser, rateLimit(RATE_RULES.password, (c) => `user:${c.var.user.id}`)] as const,
  request: { body: { required: true, ...json(PasswordChangeBody) } },
  responses: {
    200: { description: 'Contraseña cambiada: la sesión nueva', ...json(Session) },
    ...errorResponses(400, 401, 429),
  },
});

const forgotPassword = createRoute({
  method: 'post',
  path: '/auth/password/forgot',
  tags: ['Auth'],
  summary: 'Pedir el correo para recuperar la contraseña',
  description:
    'Si hay una cuenta con ese correo, Supabase le manda un link a `/reset-password` del frontend (vence en una hora). ' +
    'La respuesta es siempre `202` y el pedido sale en segundo plano, así que no deja ver si la cuenta existe. ' +
    'Hasta 5 pedidos por minuto por IP; Supabase además manda como mucho un correo por minuto a cada dirección.',
  middleware: [rateLimit(RATE_RULES.recovery)] as const,
  request: { body: { required: true, ...json(ForgotPasswordBody) } },
  responses: {
    202: { description: 'Pedido recibido (haya o no una cuenta)', ...json(ForgotPasswordResult) },
    ...errorResponses(400, 429),
  },
});

const resetPassword = createRoute({
  method: 'post',
  path: '/auth/password/reset',
  tags: ['Auth'],
  summary: 'Poner una contraseña nueva con el link del correo',
  description:
    'Canjea el `token_hash` del correo de recuperación (de un solo uso), pone la contraseña nueva y cierra todas las demás ' +
    'sesiones de la cuenta. Devuelve una sesión nueva. `400 INVALID_LINK` si el link venció o ya se usó (hay que pedir otro) y ' +
    '`400 SAME_PASSWORD` si la nueva es igual a la anterior (el link queda gastado igual).',
  middleware: [rateLimit(RATE_RULES.auth)] as const,
  request: { body: { required: true, ...json(ResetPasswordBody) } },
  responses: {
    200: { description: 'Contraseña cambiada: la sesión nueva', ...json(Session) },
    ...errorResponses(400, 429),
  },
});

const me = createRoute({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Usuario actual',
  security: bearer,
  middleware: [requireUser] as const,
  responses: {
    200: { description: 'Usuario con rol y tag', ...json(AuthUser) },
    ...errorResponses(401),
  },
});

export const auth = createRouter()
  .openapi(signup, async (c) => {
    const cfg = c.var.config;
    const { email, password, tag } = c.req.valid('json');
    // El alias se valida antes de crear la cuenta: si no, la base le pondría uno genérico.
    const check = await anonClient(cfg).rpc('alias_check', { p_tag: tag });
    if (check.error) throw fromPostgrest(check.error);
    if (check.data === 'taken') throw new AppError(409, 'CONFLICT', 'Ese alias ya está en uso.', [{ path: 'tag', message: 'Ese alias ya está en uso.' }]);
    if (check.data !== 'ok') {
      const message = check.data === 'blocked' ? 'El alias contiene una palabra no permitida.' : 'El alias tiene caracteres no permitidos.';
      throw new AppError(400, 'VALIDATION_ERROR', message, [{ path: 'tag', message }]);
    }
    const { data, error } = await anonClient(cfg).auth.signUp({
      email,
      password,
      options: { data: { tag }, emailRedirectTo: cfg.FRONTEND_URL },
    });
    if (error) throw fromAuthError(error);

    if (!data.session) return c.json({ session: null, needsConfirmation: true }, 201);

    // Como hacía la web: el trigger handle_new_user ya toma el tag de los metadatos; esto lo asegura.
    const r = await userClient(cfg, data.session.access_token).rpc('set_my_tag', { p_tag: tag });
    if (r.error) logError(c, new Error(`set_my_tag tras signup: ${r.error.code} ${r.error.message}`));
    return c.json({ session: await toSession(cfg, data.session), needsConfirmation: false }, 201);
  })
  .openapi(login, async (c) => {
    const cfg = c.var.config;
    const { email, password } = c.req.valid('json');
    const { data, error } = await anonClient(cfg).auth.signInWithPassword({ email, password });
    if (error) throw fromAuthError(error);
    if (!data.session) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió la sesión.');
    touchLastSeen(c, data.session.access_token, data.user.id);
    return c.json(await toSession(cfg, data.session), 200);
  })
  .openapi(refresh, async (c) => {
    const cfg = c.var.config;
    const { data, error } = await anonClient(cfg).auth.refreshSession(c.req.valid('json'));
    // Un refresh_token mal formado llega como validation_failed: para el cliente es una sesión inválida.
    if (error && error.code !== 'validation_failed') throw fromAuthError(error);
    if (error || !data.session) throw new AppError(401, 'UNAUTHORIZED', 'La sesión no es válida o venció. Inicia sesión de nuevo.');
    return c.json(await toSession(cfg, data.session), 200);
  })
  .openapi(logout, async (c) => {
    const cfg = c.var.config;
    // Sale de la cola del matchmaking en el acto (replanteo 63). Nunca rechaza una sala; si falla, la sesión se cierra igual.
    try {
      await c.var.sb.rpc('mm_logout' as never);
    } catch {
      // Sin matchmaking en esta base, o la base no responde: no importa para cerrar la sesión.
    }
    const res = await fetch(`${cfg.SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${c.var.user.token}` },
    });
    // 401/403/404: la sesión ya no existía. Para el cliente, el resultado es el mismo.
    if (!res.ok && ![401, 403, 404].includes(res.status)) {
      throw new AppError(500, 'INTERNAL', 'No se pudo cerrar la sesión.', undefined);
    }
    return c.body(null, 204);
  })
  .openapi(changePassword, async (c) => {
    const cfg = c.var.config;
    const { current_password, new_password } = c.req.valid('json');
    if (current_password === new_password) {
      throw new AppError(400, 'SAME_PASSWORD', 'La contraseña nueva tiene que ser distinta de la actual.', [{ path: 'new_password', message: 'Es igual a la actual.' }]);
    }
    let email = c.var.user.email;
    if (!email) {
      const u = await anonClient(cfg).auth.getUser(c.var.user.token);
      if (u.error || !u.data.user) throw fromAuthError(u.error ?? { message: 'sin usuario', status: 401 });
      email = u.data.user.email ?? null;
    }
    if (!email) throw new AppError(400, 'BUSINESS_RULE', 'La cuenta no tiene correo: no se puede cambiar la contraseña.');

    // Un login con la actual la comprueba y da una sesión recién creada, que cumple si Supabase exige una sesión reciente.
    const fresh = await anonClient(cfg).auth.signInWithPassword({ email, password: current_password });
    if (fresh.error?.code === 'invalid_credentials') {
      throw new AppError(400, 'WRONG_PASSWORD', 'La contraseña actual no es correcta.', [{ path: 'current_password', message: 'No es correcta.' }]);
    }
    if (fresh.error) throw fromAuthError(fresh.error);
    if (!fresh.data.session) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió la sesión.');
    const session = fresh.data.session;
    await setPassword(c, session.access_token, new_password, 'La contraseña nueva tiene que ser distinta de la actual.');
    return c.json(await toSession(cfg, session), 200);
  })
  .openapi(forgotPassword, async (c) => {
    const cfg = c.var.config;
    const { email } = c.req.valid('json');
    // En segundo plano y sin mirar el resultado: la respuesta y su demora son iguales con o sin cuenta.
    inBackground(
      c,
      (async () => {
        const { error } = await anonClient(cfg).auth.resetPasswordForEmail(email, { redirectTo: `${cfg.FRONTEND_URL}/reset-password` });
        if (error) throw new Error(`correo de recuperación: ${error.code ?? error.status} ${error.message}`);
      })(),
    );
    return c.json({ ok: true as const }, 202);
  })
  .openapi(resetPassword, async (c) => {
    const cfg = c.var.config;
    const { token_hash, new_password } = c.req.valid('json');
    const { data, error } = await anonClient(cfg).auth.verifyOtp({ type: 'recovery', token_hash });
    if (error && (INVALID_LINK_CODES.has(error.code ?? '') || error.status === 403 || error.status === 404)) {
      throw new AppError(400, 'INVALID_LINK', 'El enlace no es válido o venció. Pide otro correo.');
    }
    if (error) throw fromAuthError(error);
    if (!data.session) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió la sesión.');
    await setPassword(c, data.session.access_token, new_password, 'La contraseña nueva tiene que ser distinta de la anterior. Pide otro correo para elegir una.');
    return c.json(await toSession(cfg, data.session), 200);
  })
  .openapi(me, async (c) => {
    const cfg = c.var.config;
    const { token, id } = c.var.user;
    // getUser consulta a Auth: además de los datos de la cuenta, confirma que el usuario sigue existiendo.
    const { data, error } = await anonClient(cfg).auth.getUser(token);
    if (error || !data.user) throw fromAuthError(error ?? { message: 'sin usuario', status: 401 });
    touchLastSeen(c, token, id);
    return c.json(await toAuthUser(cfg, token, data.user), 200);
  });
