import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// VIP contra la Supabase local (migración 20261028120000_vip.sql y replanteo 32, plan docs/bitacora/2026-10-28-vip-fase-0).
const app = createApp();
const env = localEnv();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const playerId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const nick = `Vip${seed}`;
let adminToken: string;
let vipUser: { id: string; token: string };
let plainUser: { id: string; token: string };

const call = (method: string, path: string, body?: unknown, token?: string) =>
  app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const DAY = 86_400_000;

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  vipUser = await createUser({ tag: nick });
  plainUser = await createUser();
  const a = admin();
  check(await a.from('players').insert({ id: playerId, nick, user_id: vipUser.id }));
  check(await a.from('players').insert({ id: otherId, nick: `Otro${seed}` }));
});

afterAll(async () => {
  const a = admin();
  await a.from('vip_memberships').delete().in('user_id', [vipUser.id, plainUser.id]);
  await a.from('notifications').delete().in('user_id', [vipUser.id, plainUser.id]);
  await a.from('players').delete().in('id', [playerId, otherId]);
});

describe('VIP', () => {
  it('solo un admin lo da', async () => {
    expect((await call('POST', `/api/v1/admin/users/${vipUser.id}/vip`, { months: 1 }, plainUser.token)).status).toBe(403);
    expect((await call('POST', `/api/v1/admin/users/${crypto.randomUUID()}/vip`, { months: 1 }, adminToken)).status).toBe(404);
  });

  it('dar 1 mes y extender 3: el segundo empieza donde termina el primero', async () => {
    expect((await call('POST', `/api/v1/admin/users/${vipUser.id}/vip`, { months: 1, note: 'pagó 1 mes' }, adminToken)).status).toBe(200);
    const res = await call('POST', `/api/v1/admin/users/${vipUser.id}/vip`, { months: 3 }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vip).toMatchObject({ active: true, lifetime: false });
    expect(body.periods).toHaveLength(2);
    const [second, first] = body.periods;
    expect(first.note).toBe('pagó 1 mes');
    expect(first.granted_by.id).toBeTruthy();
    expect(second.starts_at).toBe(first.ends_at);
    expect(Date.parse(body.vip.until)).toBe(Date.parse(second.ends_at));
    expect(Date.parse(body.vip.until) - Date.now()).toBeGreaterThan(110 * DAY);
  });

  it('el dueño lo ve en Mi perfil; quien nunca fue VIP, null', async () => {
    expect((await (await call('GET', '/api/v1/me/profile', undefined, vipUser.token)).json()).vip).toMatchObject({ active: true, lifetime: false });
    expect((await (await call('GET', '/api/v1/me/profile', undefined, plainUser.token)).json()).vip).toBeNull();
  });

  it('vip público en la ficha, el listado y el comparador, sin fechas', async () => {
    const detail = await (await call('GET', `/api/v1/players/${playerId}`)).json();
    expect(detail.vip).toBe(true);
    expect((await (await call('GET', `/api/v1/players/${otherId}`)).json()).vip).toBe(false);
    const list = await (await call('GET', `/api/v1/players?q=${nick}`)).json();
    expect(list.items.find((p: { id: string }) => p.id === playerId).vip).toBe(true);
    const cmp = await (await call('GET', `/api/v1/players/compare?a=${playerId}&b=${otherId}`)).json();
    expect([cmp.a.player.vip, cmp.b.player.vip]).toEqual([true, false]);
  });

  it('lista del admin: filtros y vencimientos próximos', async () => {
    const all = await (await call('GET', `/api/v1/admin/vips?q=${nick}`, undefined, adminToken)).json();
    expect(all.items).toHaveLength(1);
    expect(all.items[0]).toMatchObject({ user: { id: vipUser.id, alias: nick }, player: { id: playerId }, status: 'active' });
    expect((await (await call('GET', `/api/v1/admin/vips?q=${nick}&expiring=7`, undefined, adminToken)).json()).items).toHaveLength(0);
    const users = await (await call('GET', `/api/v1/admin/users?q=${nick}`, undefined, adminToken)).json();
    expect(users.items[0].vip).toMatchObject({ active: true });
    expect((await call('GET', '/api/v1/admin/vips', undefined, plainUser.token)).status).toBe(403);
  });

  it('a un lifetime no se le da un temporal; quitar revoca todo y avisa', async () => {
    expect((await call('POST', `/api/v1/admin/users/${vipUser.id}/vip`, { lifetime: true }, adminToken)).status).toBe(200);
    const again = await call('POST', `/api/v1/admin/users/${vipUser.id}/vip`, { months: 1 }, adminToken);
    expect(again.status).toBe(400);
    expect((await again.json()).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'Ya es VIP lifetime' });

    const res = await call('POST', `/api/v1/admin/users/${vipUser.id}/vip/revoke`, { reason: 'prueba' }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vip).toMatchObject({ active: false, lifetime: false, until: null });
    expect(body.periods.every((p: { revoked: { reason: string } | null }) => p.revoked?.reason === 'prueba')).toBe(true);
    expect((await (await call('GET', `/api/v1/players/${playerId}`)).json()).vip).toBe(false);
    expect((await call('POST', `/api/v1/admin/users/${vipUser.id}/vip/revoke`, { reason: 'otra' }, adminToken)).status).toBe(400);

    const notes = await (await call('GET', '/api/v1/notifications?per=50', undefined, vipUser.token)).json();
    const types = notes.items.map((n: { type: string }) => n.type);
    expect(types.filter((t: string) => t === 'vip_granted')).toHaveLength(3);
    expect(types).toContain('vip_revoked');
  });
});
