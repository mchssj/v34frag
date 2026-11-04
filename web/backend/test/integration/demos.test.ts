import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Demos desde el admin contra la Supabase local (con el replanteo 14 aplicado).
const app = createApp();
const env = localEnv({ DEMO_BASE_URL: 'https://demos.test' });
const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let adminToken: string;
const serverIds = [crypto.randomUUID(), crypto.randomUUID()]; // con id del panel y sin
const ids = { pending: crypto.randomUUID(), uploaded: crypto.randomUUID(), missing: crypto.randomUUID(), nopanel: crypto.randomUUID() };
const workers: string[] = [];

const call = (method: string, path: string, body?: unknown, token = adminToken) =>
  app.request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const pending = async (token: string) => {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return sb.rpc('demo_pending', { p_token: token, p_limit: 50 });
};
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  const a = admin();
  const s = await a.from('game_servers').insert([
    { id: serverIds[0], name: `Demos ${sfx}`, token_hash: `h1-${sfx}`, panel_server_id: 'abcd1234' },
    { id: serverIds[1], name: `Sin panel ${sfx}`, token_hash: `h2-${sfx}` },
  ]);
  if (s.error) throw s.error;
  const base = { kind: 'mix', status: 'finished', side1_name: `Alfa${sfx}`, side2_name: 'Beta' };
  const m = await a.from('matches').insert([
    { ...base, id: ids.pending, map: 'de_dust2', played_at: day(1), external_id: `p-${sfx}`, server_id: serverIds[0], demo_status: 'pending', demo_attempts: 2 },
    { ...base, id: ids.uploaded, map: 'de_inferno', played_at: day(2), external_id: `u-${sfx}`, server_id: serverIds[0], demo_status: 'uploaded', demo_size: 5_000_000, demo_attempts: 1, demo_uploaded_at: day(2) },
    { ...base, id: ids.missing, map: 'de_nuke', played_at: day(3), external_id: `m-${sfx}`, server_id: serverIds[0], demo_status: 'missing', demo_attempts: 6 },
    { ...base, id: ids.nopanel, map: 'de_cache', played_at: day(4), external_id: `n-${sfx}`, server_id: serverIds[1], demo_status: 'missing', demo_attempts: 6 },
  ]);
  if (m.error) throw m.error;
});

afterAll(async () => {
  const a = admin();
  await a.from('matches').delete().in('id', Object.values(ids));
  await a.from('game_servers').delete().in('id', serverIds);
  if (workers.length) await a.from('demo_workers').delete().in('id', workers);
});

describe('demos desde el admin', () => {
  it('un usuario común no entra', async () => {
    const u = await createUser();
    for (const [m, p] of [['GET', '/api/v1/admin/demos/summary'], ['GET', '/api/v1/admin/demos'], ['GET', '/api/v1/admin/demo-workers']] as const)
      expect((await call(m, p, undefined, u.token)).status).toBe(403);
    expect((await call('POST', `/api/v1/admin/demos/${ids.missing}/retry`, undefined, u.token)).status).toBe(403);
  });

  it('resumen', async () => {
    const res = await call('GET', '/api/v1/admin/demos/summary');
    expect(res.status).toBe(200);
    const s = await res.json();
    expect(s.pending).toBeGreaterThanOrEqual(1);
    expect(s.missing).toBeGreaterThanOrEqual(2);
    expect(s.uploaded_bytes).toBeGreaterThanOrEqual(5_000_000);
    expect(typeof s.worker_online).toBe('boolean');
  });

  it('listado con filtros, orden, vencimiento y link de descarga', async () => {
    let body = await (await call('GET', `/api/v1/admin/demos?q=alfa${sfx}`)).json();
    expect(body.total).toBe(4);
    expect(body.items.map((d: { match_id: string }) => d.match_id)).toEqual([ids.pending, ids.uploaded, ids.missing, ids.nopanel]);

    const up = body.items[1];
    expect(up).toMatchObject({ demo_status: 'uploaded', demo_size: 5_000_000, demo_url: `https://demos.test/demo/u-${sfx}`, can_retry: false });
    expect(new Date(up.expires_at).getTime() - new Date(up.demo_uploaded_at).getTime()).toBe(90 * 86_400_000);
    expect(up.server).toEqual({ id: serverIds[0], name: `Demos ${sfx}`, has_panel: true });
    expect(body.items[0]).toMatchObject({ demo_url: null, expires_at: null });
    expect(body.items[2]).toMatchObject({ can_retry: true });
    expect(body.items[3]).toMatchObject({ can_retry: false, server: { has_panel: false } });

    body = await (await call('GET', `/api/v1/admin/demos?q=alfa${sfx}&status=missing&sort=played_at&order=asc`)).json();
    expect(body.items.map((d: { match_id: string }) => d.match_id)).toEqual([ids.nopanel, ids.missing]);
    body = await (await call('GET', `/api/v1/admin/demos?server=${serverIds[1]}`)).json();
    expect(body.items.map((d: { match_id: string }) => d.match_id)).toEqual([ids.nopanel]);
    body = await (await call('GET', `/api/v1/admin/demos?q=alfa${sfx}&from=${day(2.5)}&to=${day(0.5)}`)).json();
    expect(body.total).toBe(2);
    body = await (await call('GET', `/api/v1/admin/demos?q=alfa${sfx}&kind=pcw`)).json();
    expect(body.total).toBe(0);
    expect((await call('GET', '/api/v1/admin/demos?status=none')).status).toBe(400);
  });

  it('reintentar: solo una perdida de un servidor con id del panel', async () => {
    const no = await call('POST', `/api/v1/admin/demos/${ids.nopanel}/retry`);
    expect(no.status).toBe(400);
    expect((await no.json()).error.message).toBe('El servidor de esta partida no tiene id del panel: el Worker no puede bajar la demo');
    const up = await call('POST', `/api/v1/admin/demos/${ids.uploaded}/retry`);
    expect((await up.json()).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'La demo ya está subida' });

    expect((await call('POST', `/api/v1/admin/demos/${ids.missing}/retry`)).status).toBe(204);
    const m = await admin().from('matches').select('demo_status, demo_attempts').eq('id', ids.missing).single();
    expect(m.data).toEqual({ demo_status: 'pending', demo_attempts: 0 });
  });

  it('ciclo del Worker: alta, en línea, editar, token nuevo con confirmación, revocar y borrar', async () => {
    let res = await call('POST', '/api/v1/admin/demo-workers', { name: `Worker ${sfx}` });
    expect(res.status).toBe(201);
    const w = await res.json();
    workers.push(w.id);
    expect(w.token).toMatch(/^demow_[0-9a-f]{64}$/);
    expect(w.secret_command).toContain('wrangler secret put DEMO_WORKER_TOKEN');

    // El Worker usa su token: ve la demo reintentada y queda en línea.
    const p = await pending(w.token);
    expect(p.error).toBeNull();
    expect((p.data as { external_id: string }[]).map((x) => x.external_id)).toContain(`m-${sfx}`);
    let list = await (await call('GET', `/api/v1/admin/demo-workers?q=worker ${sfx}&online=true`)).json();
    expect(list.items).toMatchObject([{ id: w.id, active: true, online: true }]);
    expect(list.items[0]).not.toHaveProperty('token_hash');
    expect((await (await call('GET', '/api/v1/admin/demos/summary')).json()).worker_online).toBe(true);

    expect((await call('POST', '/api/v1/admin/demo-workers', { name: ` WORKER ${sfx}` })).status).toBe(409);
    res = await call('POST', '/api/v1/admin/demo-workers', { name: `Otro ${sfx}` });
    workers.push((await res.json()).id);
    res = await call('PATCH', `/api/v1/admin/demo-workers/${w.id}`, { name: `otro ${sfx}` });
    expect(res.status).toBe(409);
    expect((await res.json()).error.message).toBe('Ya hay un Worker con ese nombre.');
    res = await call('PATCH', `/api/v1/admin/demo-workers/${w.id}`, { name: `Renombrado ${sfx}` });
    expect(await res.json()).toMatchObject({ name: `Renombrado ${sfx}`, online: true });

    // Token nuevo: sin confirmar no; confirmado, el viejo deja de servir.
    res = await call('POST', `/api/v1/admin/demo-workers/${w.id}/token`, { confirm: 'ok' });
    expect(res.status).toBe(400);
    expect((await res.json()).error.details).toEqual([{ path: 'confirm', message: 'Para generar un token nuevo, escribe "estoy seguro".' }]);
    res = await call('POST', `/api/v1/admin/demo-workers/${w.id}/token`, { confirm: 'Estoy seguro' });
    expect(res.status).toBe(200);
    const nuevo = await res.json();
    expect(nuevo.token).not.toBe(w.token);
    expect((await pending(w.token)).error?.message).toBe('Token del Worker inválido o revocado');
    expect((await pending(nuevo.token)).error).toBeNull();

    res = await call('PATCH', `/api/v1/admin/demo-workers/${w.id}`, { active: false });
    expect(await res.json()).toMatchObject({ active: false });
    expect((await pending(nuevo.token)).error?.message).toBe('Token del Worker inválido o revocado');
    list = await (await call('GET', `/api/v1/admin/demo-workers?q=${sfx}&active=false`)).json();
    expect(list.items.map((x: { id: string }) => x.id)).toEqual([w.id]);

    const ghost = '00000000-0000-4000-8000-000000000000';
    expect((await call('PATCH', `/api/v1/admin/demo-workers/${ghost}`, { active: true })).status).toBe(404);
    expect((await call('POST', `/api/v1/admin/demo-workers/${ghost}/token`, { confirm: 'estoy seguro' })).status).toBe(404);
    expect((await call('DELETE', `/api/v1/admin/demo-workers/${w.id}`)).status).toBe(204);
    expect((await call('DELETE', `/api/v1/admin/demo-workers/${w.id}`)).status).toBe(404);
  });
});
