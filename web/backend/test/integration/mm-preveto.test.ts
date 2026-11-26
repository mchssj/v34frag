import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Preveto de mapas para VIP (replanteo 146, bitácora 2026-11-25-preveto-vip). Solo lee el pool y la configuración: las
// reglas del conteo se prueban en docs/bitacora/2026-11-25-preveto-vip/pruebas/preveto_146.sql.
const app = createApp();
const env = localEnv();
let vip: { id: string; token: string };
let common: { id: string; token: string };
let pool: string[] = [];

const put = async (token: string | undefined, body: unknown) => {
  const res = await app.request('/api/v1/mm/preveto', {
    method: 'PUT', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  }, env);
  return { status: res.status, body: (await res.json()) as any };
};

beforeAll(async () => {
  [vip, common] = await Promise.all([createUser(), createUser()]);
  const db = admin();
  const r = await db.from('vip_memberships').insert({ user_id: vip.id, source: 'import' });
  if (r.error) throw r.error;
  pool = ((await db.from('mm_mode_maps' as never).select('map').eq('mode', '5v5').order('position')).data as { map: string }[] | null ?? []).map((m) => m.map);
});
afterAll(async () => {
  for (const u of [vip, common]) if (u) await admin().auth.admin.deleteUser(u.id);
});

describe('PUT /mm/preveto', () => {
  it('el VIP elige un mapa del pool y lo saca', async () => {
    const r = await put(vip.token, { mode: '5v5', map: pool[0] });
    expect(r.status).toBe(200);
    const mode = r.body.preveto.modes.find((m: any) => m.mode === '5v5');
    expect(r.body.preveto.allowed).toBe(true);
    expect(mode.map).toBe(pool[0]);
    expect(mode.pool.map((m: any) => m.name)).toEqual(pool);
    const off = await put(vip.token, { mode: '5v5', map: null });
    expect(off.body.preveto.modes.find((m: any) => m.mode === '5v5').map).toBeNull();
  });
  it('un mapa de fuera del pool no', async () => {
    expect((await put(vip.token, { mode: '5v5', map: 'de_no_existe' })).status).toBe(400);
  });
  it('sin VIP, 403; sacarlo se puede', async () => {
    expect((await put(common.token, { mode: '5v5', map: pool[0] })).status).toBe(403);
    const off = await put(common.token, { mode: '5v5', map: null });
    expect([off.status, off.body.preveto]).toEqual([200, { allowed: false, modes: [] }]);
  });
  it('sin sesión, 401; sin el mapa, 400', async () => {
    expect((await put(undefined, { mode: '5v5', map: null })).status).toBe(401);
    expect((await put(vip.token, { mode: '5v5' })).status).toBe(400);
  });
});
