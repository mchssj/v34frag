import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';
// Sufijo para que los alias (únicos desde el replanteo 09) no choquen entre corridas.
const sfx = Date.now().toString(36).slice(-5);

const app = createApp();
const env = localEnv();
const post = (path: string, body?: unknown, token?: string) =>
  app.request(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
const getMe = (token?: string) => app.request('/auth/me', token ? { headers: { Authorization: `Bearer ${token}` } } : {}, env);

const nuevoEmail = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@test.local`;

async function lastSeen(id: string): Promise<string | null> {
  const { data } = await admin().from('profile_details').select('last_seen').eq('user_id', id).maybeSingle();
  return data?.last_seen ?? null;
}
async function esperar<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 3000): Promise<T> {
  const fin = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (ok(v) || Date.now() > fin) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe('POST /auth/signup', () => {
  it('crea la cuenta con el tag y devuelve la sesión (local sin confirmación de email)', async () => {
    const email = nuevoEmail();
    const res = await post('/auth/signup', { email, password: 'clave-segura-1', tag: `  Nuevo1${sfx}  ` });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.needsConfirmation).toBe(false);
    expect(body.session.user).toMatchObject({ email, tag: `Nuevo1${sfx}`, role: 'user' });
    expect(body.session.access_token).toBeTruthy();
    const p = await admin().from('profiles').select('tag').eq('id', body.session.user.id).single();
    expect(p.data?.tag).toBe(`Nuevo1${sfx}`);
  });

  it('409 si el email ya tiene cuenta', async () => {
    const u = await createUser();
    const res = await post('/auth/signup', { email: u.email, password: 'otra-clave-1', tag: 'Repetido' });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('CONFLICT');
  });

  it('400 con detalle por campo si los datos no sirven', async () => {
    const res = await post('/auth/signup', { email: 'no-es-email', password: '123', tag: 'x' });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password', 'tag']);
  });

  it('400 si el cuerpo no es JSON', async () => {
    const res = await app.request('/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{roto' }, env);
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('inicia sesión con rol y tag, y actualiza last_seen', async () => {
    const u = await createUser({ tag: `Logueado${sfx}`, role: 'admin' });
    const antes = await lastSeen(u.id);
    const res = await post('/auth/login', { email: u.email, password: u.password });
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.user).toMatchObject({ id: u.id, email: u.email, tag: `Logueado${sfx}`, role: 'admin' });
    expect(s.expires_at).toBeGreaterThan(Date.now() / 1000);
    const despues = await esperar(() => lastSeen(u.id), (v) => v !== null && v !== antes);
    expect(despues).not.toBe(antes);
  });

  it('401 INVALID_CREDENTIALS con la contraseña equivocada', async () => {
    const u = await createUser();
    const res = await post('/auth/login', { email: u.email, password: 'no-es-esta' });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('INVALID_CREDENTIALS');
  });

  it('429 al intento 11 de la misma IP en un minuto', async () => {
    const limitada = createApp();
    const e = localEnv({ CLIENT_IP_HEADER: 'x-forwarded-for' });
    const intento = () =>
      limitada.request(
        '/auth/login',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7' }, body: JSON.stringify({ email: 'nadie@test.local', password: 'x' }) },
        e,
      );
    for (let i = 0; i < 10; i++) expect((await intento()).status).toBe(401);
    const res = await intento();
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});

describe('refresh, me y logout', () => {
  it('refresh entrega una sesión nueva y el refresh_token usado deja de servir', async () => {
    const u = await createUser({ tag: `Refresco${sfx}` });
    const res = await post('/auth/refresh', { refresh_token: u.refresh });
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.refresh_token).not.toBe(u.refresh);
    expect(s.user).toMatchObject({ id: u.id, tag: `Refresco${sfx}` });
    // Reusar el viejo fuera del margen de reutilización de Supabase invalida la familia de tokens.
    const otra = await post('/auth/refresh', { refresh_token: 'token-que-no-existe' });
    expect(otra.status).toBe(401);
  });

  it('me devuelve la cuenta con fecha de registro', async () => {
    const u = await createUser({ tag: `Yo${sfx}` });
    const res = await getMe(u.token);
    expect(res.status).toBe(200);
    const me = await res.json();
    expect(me).toMatchObject({ id: u.id, email: u.email, tag: `Yo${sfx}`, role: 'user' });
    expect(Date.parse(me.created_at)).toBeGreaterThan(0);
  });

  it('me sin token responde 401', async () => {
    expect((await getMe()).status).toBe(401);
  });

  it('logout responde 204 y el refresh_token de esa sesión deja de servir', async () => {
    const u = await createUser();
    expect((await post('/auth/logout', undefined, u.token)).status).toBe(204);
    expect((await post('/auth/refresh', { refresh_token: u.refresh })).status).toBe(401);
    // Repetir el logout no falla.
    expect((await post('/auth/logout', undefined, u.token)).status).toBe(204);
  });
});

describe('POST /api/v1/me/password', () => {
  it('cambia la contraseña, cierra las otras sesiones y devuelve una sesión nueva', async () => {
    const u = await createUser();
    // Otra sesión de la misma cuenta (otra PC).
    const otraPc = await (await post('/auth/login', { email: u.email, password: u.password })).json();

    const res = await post('/api/v1/me/password', { current_password: u.password, new_password: 'otra-clave-nueva-456' }, u.token);
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.user).toMatchObject({ id: u.id, email: u.email });
    expect(s.refresh_token).toBeTruthy();

    expect((await post('/auth/login', { email: u.email, password: u.password })).status).toBe(401);
    expect((await post('/auth/login', { email: u.email, password: 'otra-clave-nueva-456' })).status).toBe(200);
    // Las sesiones de antes ya no se renuevan; la nueva sí.
    expect((await post('/auth/refresh', { refresh_token: u.refresh })).status).toBe(401);
    expect((await post('/auth/refresh', { refresh_token: otraPc.refresh_token })).status).toBe(401);
    expect((await post('/auth/refresh', { refresh_token: s.refresh_token })).status).toBe(200);
  });

  it('400 WRONG_PASSWORD, SAME_PASSWORD y VALIDATION_ERROR; 401 sin sesión', async () => {
    const u = await createUser();
    const mal = await post('/api/v1/me/password', { current_password: 'no-es-esta', new_password: 'otra-clave-456' }, u.token);
    expect(mal.status).toBe(400);
    expect((await mal.json()).error.code).toBe('WRONG_PASSWORD');
    const igual = await post('/api/v1/me/password', { current_password: u.password, new_password: u.password }, u.token);
    expect((await igual.json()).error.code).toBe('SAME_PASSWORD');
    const corta = await post('/api/v1/me/password', { current_password: u.password, new_password: '123' }, u.token);
    expect((await corta.json()).error.code).toBe('VALIDATION_ERROR');
    expect((await post('/api/v1/me/password', { current_password: u.password, new_password: 'otra-clave-456' })).status).toBe(401);
    // Nada de eso la cambió.
    expect((await post('/auth/login', { email: u.email, password: u.password })).status).toBe(200);
  });

  it('429 al sexto intento de la misma cuenta en un minuto', async () => {
    const limitada = createApp();
    const u = await createUser();
    const intento = () =>
      limitada.request(
        '/api/v1/me/password',
        { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u.token}` }, body: JSON.stringify({ current_password: 'no-es-esta', new_password: 'otra-clave-456' }) },
        env,
      );
    for (let i = 0; i < 5; i++) expect((await intento()).status).toBe(400);
    const res = await intento();
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});
