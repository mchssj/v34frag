import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Notificaciones contra la Supabase local (con el replanteo 28 aplicado): las crea la base al usar la API.
const app = createApp();
const env = localEnv();
type U = Awaited<ReturnType<typeof createUser>>;

const rnd = () => Math.random().toString(36).slice(2, 8);
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
const start = new Date().toISOString();

async function req(method: string, path: string, opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const res = await app.request(
    path,
    {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, etag: res.headers.get('ETag') };
}

async function player() {
  const u = await createUser({ tag: `N${rnd()}` });
  const { data, error } = await admin().from('players').insert({ nick: 'x', user_id: u.id, steam_id: steam() }).select('id').single();
  if (error) throw error;
  return { ...u, playerId: data.id as string };
}

const mine = async (u: U, query = '') => (await req('GET', `/api/v1/notifications${query}`, { token: u.token })).body;

let adm: U;
let cap: Awaited<ReturnType<typeof player>>;
let jug: Awaited<ReturnType<typeof player>>;
let team: string;

beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
  cap = await player();
  jug = await player();
});

// Los avisos a los admins también les llegan a los admins de la base local: se borran al terminar.
afterAll(async () => {
  await admin().from('notifications').delete().gte('created_at', start);
});

describe('notificaciones', () => {
  it('pedido para crear un equipo: le llega a los admins y la respuesta al que lo pidió', async () => {
    const name = `Notif ${rnd()}`;
    expect((await req('PUT', '/api/v1/me/team-request', { token: cap.token, body: { name, tag: 'NTF' } })).status).toBe(200);
    const a = await mine(adm, '?category=admin');
    expect(a.items).toContainEqual(expect.objectContaining({ type: 'admin_team_request', data: expect.objectContaining({ name }) }));
    const ap = await req('POST', `/api/v1/admin/team-requests/${cap.id}/approve`, { token: adm.token });
    expect(ap.status).toBe(201);
    team = ap.body.id;
    expect((await mine(cap)).items).toContainEqual(
      expect.objectContaining({ type: 'team_request_answered', data: expect.objectContaining({ approved: true }), actor: expect.objectContaining({ id: adm.id }) }),
    );
  });

  it('invitar y aceptar: accionable, resuelta y el líder se entera', async () => {
    const inv = await req('POST', `/api/v1/teams/${team}/invites`, { token: cap.token, body: { player_id: jug.playerId } });
    expect(inv.status).toBe(201);

    const c0 = await req('GET', '/api/v1/notifications/unread-count', { token: jug.token });
    expect(c0.body).toEqual({ unread: 1, actionable: 1 });
    expect((await req('GET', '/api/v1/notifications/unread-count', { token: jug.token, headers: { 'If-None-Match': c0.etag! } })).status).toBe(304);

    const list = await mine(jug, '?actionable=true');
    expect(list.items).toEqual([expect.objectContaining({ type: 'team_invite', actionable: true, resolution: null, read: false })]);
    const inviteId = list.items[0].data.invite_id as string;

    expect((await req('POST', `/api/v1/team-invites/${inviteId}/accept`, { token: jug.token })).status).toBe(204);
    expect((await mine(jug)).items[0]).toMatchObject({ type: 'team_invite', resolution: 'accepted' });
    expect((await req('GET', '/api/v1/notifications/unread-count', { token: jug.token })).body.actionable).toBe(0);
    expect((await mine(cap)).items).toContainEqual(
      expect.objectContaining({ type: 'team_invite_answered', data: expect.objectContaining({ accepted: true }) }),
    );
  });

  it('marcar como leídas: una, después todas; las de otra cuenta no se tocan', async () => {
    const id = (await mine(cap)).items[0].id as number;
    expect((await req('POST', '/api/v1/notifications/read', { token: jug.token, body: { ids: [id] } })).status).toBe(204);
    expect((await mine(cap)).items[0].read).toBe(false);
    expect((await req('POST', '/api/v1/notifications/read', { token: cap.token, body: { ids: [id] } })).status).toBe(204);
    expect((await mine(cap)).items[0].read).toBe(true);
    expect((await req('POST', '/api/v1/notifications/read', { token: cap.token, body: { all: true } })).status).toBe(204);
    expect((await req('GET', '/api/v1/notifications/unread-count', { token: cap.token })).body.unread).toBe(0);
    expect((await mine(cap, '?unread=true')).total).toBe(0);
  });

  it('preferencias: una categoría apagada no llega; las obligatorias sí', async () => {
    const p = await req('PATCH', '/api/v1/me/profile', { token: jug.token, body: { preferences: { notifications: { team: false } } } });
    expect(p.status).toBe(200);
    expect(p.body.preferences.notifications).toMatchObject({ team: false, news: false, pcw: true });

    // Sale del equipo: el líder recibe "se fue" (su categoría está prendida).
    expect((await req('POST', `/api/v1/teams/${team}/leave`, { token: jug.token })).status).toBe(204);
    expect((await mine(cap)).items).toContainEqual(expect.objectContaining({ type: 'team_member_left' }));

    // Lo vuelven a invitar: la invitación es obligatoria y llega igual.
    expect((await req('POST', `/api/v1/teams/${team}/invites`, { token: cap.token, body: { player_id: jug.playerId } })).status).toBe(201);
    const items = (await mine(jug)).items as { type: string; resolution: string | null }[];
    expect(items.filter((n) => n.type === 'team_invite' && n.resolution === null)).toHaveLength(1);
  });
});
