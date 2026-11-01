import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Moderar equipos (replanteo 43): lista, historial y acciones del staff con motivo y aviso al líder.
const app = createApp();
const env = localEnv();
type U = Awaited<ReturnType<typeof createUser>>;

const rnd = () => Math.random().toString(36).slice(2, 8);
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.request(
    path,
    {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function player(user?: U) {
  const p = (await admin().from('players').insert({ nick: `M${rnd()}${rnd()}`, steam_id: steam(), user_id: user?.id ?? null }).select('id').single()).data!;
  return p.id as string;
}

let adm: U;
let mod: U;
let cap: U;
let other: U;
let team: string;
let capPlayer: string;
let member: string;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
  mod = await createUser({ tag: `Mod${rnd()}` });
  cap = await createUser({ tag: `Cap${rnd()}` });
  other = await createUser({ tag: `Otro${rnd()}` });
  expect((await req('PUT', `/api/v1/admin/users/${mod.id}/role`, { token: adm.token, body: { role: 'moderator' } })).status).toBe(204);
  capPlayer = await player(cap);
  member = await player(other);
  const created = await req('POST', '/api/v1/teams', { token: cap.token, body: { name: `Moderable ${rnd()}`, tag: rnd().slice(0, 5) } });
  expect(created.status).toBe(201);
  team = created.body.id;
  await admin().from('team_members').insert({ team_id: team, player_id: member, joined_at: new Date().toISOString() });
});

const staffNotices = async (u: U) =>
  (await req('GET', '/api/v1/notifications?per=50', { token: u.token })).body.items.filter((n: { type: string }) => n.type === 'team_staff_action');

describe('moderar equipos', () => {
  it('lista e historial: moderadores y admins sí, el resto no', async () => {
    expect((await req('GET', '/api/v1/admin/teams', { token: cap.token })).status).toBe(403);
    const list = await req('GET', `/api/v1/admin/teams?filter=incomplete&q=${encodeURIComponent('Moderable')}&per=100`, { token: mod.token });
    expect(list.status).toBe(200);
    expect(list.body.items.find((t: { id: string }) => t.id === team)).toMatchObject({ members: 2, players: 2, blocked: false, captain: { player_id: capPlayer } });
    const h = await req('GET', `/api/v1/admin/teams/${team}/history`, { token: mod.token });
    expect(h.body.items.map((e: { action: string }) => e.action)).toEqual(['member_added', 'member_added', 'created']);
    expect(h.body.items[2]).toMatchObject({ actor_role: 'team', actor: { user_id: cap.id } });
  });

  it('el moderador renombra, quita el logo y saca a un miembro; el líder recibe cada aviso', async () => {
    const name = `Renombrado ${rnd()}`;
    expect((await req('PATCH', `/api/v1/admin/teams/${team}`, { token: mod.token, body: { name, reason: 'Nombre ofensivo' } })).status).toBe(204);
    expect((await req('GET', `/api/v1/teams/${team}`)).body.name).toBe(name);
    expect((await req('PATCH', `/api/v1/admin/teams/${team}`, { token: mod.token, body: { captain_player_id: member } })).status).toBe(403);
    expect((await req('POST', `/api/v1/admin/teams/${team}/logo/remove`, { token: mod.token })).status).toBe(400);
    const kickLeader = await req('POST', `/api/v1/admin/teams/${team}/members/${capPlayer}/remove`, { token: mod.token, body: {} });
    expect(kickLeader.status).toBe(409);
    expect((await req('POST', `/api/v1/admin/teams/${team}/members/${member}/remove`, { token: mod.token, body: { reason: 'Baneado' } })).status).toBe(204);
    const notes = await staffNotices(cap);
    expect(notes.map((n: { data: { action: string } }) => n.data.action).sort()).toEqual(['member_removed', 'renamed']);
    expect(notes.find((n: { data: { action: string } }) => n.data.action === 'renamed').data).toMatchObject({ by: 'moderator', reason: 'Nombre ofensivo' });
    const removed = (await req('GET', '/api/v1/notifications?per=50', { token: other.token })).body.items.find((n: { type: string }) => n.type === 'team_removed');
    expect(removed.data.reason).toBe('Baneado');
    const h = await req('GET', `/api/v1/admin/teams/${team}/history?per=2`, { token: adm.token });
    expect(h.body.items[0]).toMatchObject({ action: 'member_removed', actor_role: 'moderator', reason: 'Baneado', actor: { user_id: mod.id } });
    // El alias del autor sale de su ficha: la del líder se ve aunque quien consulta sea otro.
    const full = await req('GET', `/api/v1/admin/teams/${team}/history?per=50`, { token: mod.token });
    expect(full.body.items.find((e: { action: string }) => e.action === 'created').actor.alias).toBeTruthy();
    expect((await req('POST', `/api/v1/admin/teams/${team}/dissolve`, { token: mod.token, body: {} })).status).toBe(403);
  });

  it('el admin suma, cambia el rol y el líder, y disuelve', async () => {
    expect((await req('POST', `/api/v1/admin/teams/${team}/members`, { token: mod.token, body: { player_id: member } })).status).toBe(403);
    expect((await req('POST', `/api/v1/admin/teams/${team}/members`, { token: adm.token, body: { player_id: member, role: 'sub', reason: 'Vuelve' } })).status).toBe(204);
    expect((await req('PATCH', `/api/v1/admin/teams/${team}/members/${member}`, { token: adm.token, body: { role: 'player' } })).status).toBe(204);
    expect((await req('PATCH', `/api/v1/admin/teams/${team}`, { token: adm.token, body: { captain_player_id: member, reason: 'Pedido del equipo' } })).status).toBe(204);
    expect((await req('GET', `/api/v1/teams/${team}`)).body.captain.player_id).toBe(member);
    expect((await staffNotices(other)).some((n: { data: { action: string } }) => n.data.action === 'captain_changed')).toBe(true);
    expect((await req('POST', `/api/v1/admin/teams/${team}/dissolve`, { token: adm.token, body: { reason: 'Inactivo' } })).status).toBe(204);
    const list = await req('GET', `/api/v1/admin/teams?q=${encodeURIComponent('Renombrado')}&per=100`, { token: adm.token });
    expect(list.body.items.some((t: { id: string }) => t.id === team)).toBe(false);
  });
});
