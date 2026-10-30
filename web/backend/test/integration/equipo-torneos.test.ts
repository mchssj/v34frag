import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Equipo y Torneos (replanteo 33, bitácora 2026-10-28-equipo-torneos-api) contra la Supabase local.
const app = createApp();
const env = localEnv();
type U = Awaited<ReturnType<typeof createUser>>;

const rnd = () => Math.random().toString(36).slice(2, 8);
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

async function req(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData } = {}) {
  const res = await app.request(
    path,
    {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Cabecera de un PNG de w×h (alcanza para validar las medidas; Storage no decodifica la imagen). */
function png(w: number, h: number): File {
  const b = new Uint8Array(64);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return new File([b], 'img.png', { type: 'image/png' });
}
const form = (fields: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

/** Usuario con ficha y SteamID. */
async function player(tag = `P${rnd()}`) {
  const u = await createUser({ tag });
  const id = (await admin().from('players').insert({ nick: tag, user_id: u.id, steam_id: steam() }).select('id').single()).data!.id as string;
  return { ...u, player: id, tag };
}

/** Equipo oficial: capitán con cuenta y `extra` jugadores con SteamID sin cuenta. */
async function team(extra = 4) {
  const cap = await player(`Cap${rnd()}`);
  const sb = admin();
  const t = (await sb.from('teams').insert({ name: `ET ${rnd()}`, tag: 'ET', kind: 'official', captain_id: cap.id, owner_id: cap.id }).select('id').single()).data!;
  const others = extra
    ? (await sb.from('players').insert(Array.from({ length: extra }, (_, i) => ({ nick: `E${i}${rnd()}`, steam_id: steam() }))).select('id')).data!.map((p) => p.id as string)
    : [];
  const players = [cap.player, ...others];
  const r = await sb.from('team_members').insert(players.map((p) => ({ team_id: t.id, player_id: p, joined_at: new Date().toISOString() })));
  if (r.error) throw r.error;
  return { id: t.id as string, cap, players };
}

let adm: U;
let org: U;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
  org = await createUser({ tag: `Org${rnd()}` });
  expect((await req('PUT', `/api/v1/admin/users/${org.id}/role`, { token: adm.token, body: { role: 'organizer' } })).status).toBe(204);
});

describe('plantel', () => {
  it('invitar con estado y mensaje, quién invitó, ELO del jugador y el estado al aceptar', async () => {
    const t = await team(0);
    const p = await player();
    const inv = await req('POST', `/api/v1/teams/${t.id}/invites`, { token: t.cap.token, body: { player_id: p.player, role: 'sub', message: 'Hola' } });
    expect(inv.status).toBe(201);
    const mine = await req('GET', '/api/v1/me/team-invites', { token: p.token });
    expect(mine.body.items[0]).toMatchObject({
      role: 'sub', message: 'Hola', invited_by: { player_id: t.cap.player, alias: t.cap.tag }, player: { id: p.player, elo: null, level: null },
    });
    expect(mine.body.items[0].team).toHaveProperty('logo_url', null);
    expect((await req('POST', `/api/v1/team-invites/${inv.body.id}/accept`, { token: p.token })).status).toBe(204);
    const m = await req('GET', `/api/v1/teams/${t.id}/members?active=true`);
    expect(m.body.items.find((x: { player_id: string }) => x.player_id === p.player)).toMatchObject({ role: 'sub', game_role: null });

    // Pedido con mensaje: el capitán lo ve sin invited_by.
    const q = await player();
    expect((await req('POST', `/api/v1/teams/${t.id}/join-requests`, { token: q.token, body: { message: 'Quiero entrar' } })).status).toBe(201);
    const pend = await req('GET', `/api/v1/teams/${t.id}/pending?kind=request`, { token: t.cap.token });
    expect(pend.body.items[0]).toMatchObject({ kind: 'request', role: 'player', message: 'Quiero entrar', invited_by: null });
    // Sin cuerpo también se puede pedir.
    const r2 = await player();
    expect((await req('POST', `/api/v1/teams/${t.id}/join-requests`, { token: r2.token })).status).toBe(201);
  });

  it('el capitán cambia el estado; 404 NOT_A_MEMBER y 403 para los demás', async () => {
    const t = await team(1);
    const otro = await player();
    const ok = await req('PATCH', `/api/v1/teams/${t.id}/members/${t.players[1]}`, { token: t.cap.token, body: { role: 'coach' } });
    expect(ok).toMatchObject({ status: 200, body: { player_id: t.players[1], role: 'coach' } });
    const no = await req('PATCH', `/api/v1/teams/${t.id}/members/${otro.player}`, { token: t.cap.token, body: { role: 'sub' } });
    expect(no).toMatchObject({ status: 404, body: { error: { code: 'NOT_A_MEMBER' } } });
    expect((await req('PATCH', `/api/v1/teams/${t.id}/members/${t.players[1]}`, { token: otro.token, body: { role: 'sub' } })).status).toBe(403);
  });

  it('máximo de miembros del admin: 409 ROSTER_FULL, has_space y max_members', async () => {
    const before = (await req('GET', '/api/v1/admin/teams/config', { token: adm.token })).body.max_members as number;
    const t = await team(1);
    try {
      expect((await req('PUT', '/api/v1/admin/teams/config', { token: t.cap.token, body: { max_members: 2 } })).status).toBe(403);
      expect((await req('PUT', '/api/v1/admin/teams/config', { token: adm.token, body: { max_members: 2 } })).body).toEqual({ max_members: 2 });
      const d = await req('GET', `/api/v1/teams/${t.id}`);
      expect(d.body).toMatchObject({ members: 2, max_members: 2 });
      const full = await req('GET', `/api/v1/teams?has_space=false&q=${encodeURIComponent('ET')}&per=100`);
      expect(full.body.items.some((x: { id: string }) => x.id === t.id)).toBe(true);
      const p = await player();
      const inv = await req('POST', `/api/v1/teams/${t.id}/invites`, { token: t.cap.token, body: { player_id: p.player } });
      expect(inv).toMatchObject({ status: 409, body: { error: { code: 'ROSTER_FULL' } } });
    } finally {
      await req('PUT', '/api/v1/admin/teams/config', { token: adm.token, body: { max_members: before } });
    }
  });
});

describe('equipo', () => {
  it('looking_for: lo edita el capitán y filtra el listado', async () => {
    const t = await team(1);
    expect((await req('PATCH', `/api/v1/teams/${t.id}`, { token: t.cap.token, body: { looking_for: ['sub', 'coach'] } })).status).toBe(204);
    const d = await req('GET', `/api/v1/teams/${t.id}`);
    expect(d.body).toMatchObject({ looking_for: ['coach', 'sub'], logo_url: null });
    expect(d.body.founded_at).toBeTruthy();
    expect(d.body.record === null || typeof d.body.record.events_played === 'number').toBe(true);
    const l = await req('GET', '/api/v1/teams?looking_for=coach&per=100');
    expect(l.body.items.some((x: { id: string }) => x.id === t.id)).toBe(true);
    const l2 = await req('GET', '/api/v1/teams?looking_for=player&per=100');
    expect(l2.body.items.some((x: { id: string }) => x.id === t.id)).toBe(false);
    expect((await req('GET', '/api/v1/teams?looking_for=capo')).status).toBe(400);
    const otro = await player();
    expect((await req('PATCH', `/api/v1/teams/${t.id}`, { token: otro.token, body: { looking_for: [] } })).status).toBe(403);
  });

  it('logo: valida medidas, lo sube el capitán, sale en el equipo y en mis equipos, y se quita', async () => {
    const t = await team(0);
    const bad = await req('PUT', `/api/v1/teams/${t.id}/logo`, { token: t.cap.token, form: form({ file: png(300, 200) }) });
    expect(bad).toMatchObject({ status: 400, body: { error: { code: 'INVALID_FILE' } } });
    const small = await req('PUT', `/api/v1/teams/${t.id}/logo`, { token: t.cap.token, form: form({ file: png(64, 64) }) });
    expect(small.status).toBe(400);
    const up = await req('PUT', `/api/v1/teams/${t.id}/logo`, { token: t.cap.token, form: form({ file: png(256, 256) }) });
    expect(up.status).toBe(200);
    expect(up.body.logo_url).toContain(`/photos/teams/${t.id}/`);
    expect((await req('GET', `/api/v1/teams/${t.id}`)).body.logo_url).toBe(up.body.logo_url);
    const mine = await req('GET', '/api/v1/me/teams', { token: t.cap.token });
    expect(mine.body).toEqual([expect.objectContaining({ id: t.id, my_role: 'leader', logo_url: up.body.logo_url })]);
    const otro = await player();
    expect((await req('PUT', `/api/v1/teams/${t.id}/logo`, { token: otro.token, form: form({ file: png(256, 256) }) })).status).toBe(403);
    expect((await req('DELETE', `/api/v1/teams/${t.id}/logo`, { token: t.cap.token })).status).toBe(204);
    expect((await req('GET', `/api/v1/teams/${t.id}`)).body.logo_url).toBeNull();
  });

  it('solicitud de equipo nuevo con logo (multipart) y el logo pasa al equipo', async () => {
    const p = await player();
    const r = await req('PUT', '/api/v1/me/team-request', { token: p.token, form: form({ name: `Logo ${rnd()}`, tag: 'lg', logo: png(512, 512) }) });
    expect(r).toMatchObject({ status: 200, body: { tag: 'LG', status: 'pending' } });
    expect(r.body.logo_url).toContain(`/photos/team-requests/${p.id}/`);
    // JSON sin logo conserva el que tenía.
    const j = await req('PUT', '/api/v1/me/team-request', { token: p.token, body: { name: `Logo ${rnd()}`, tag: 'LG' } });
    expect(j.body.logo_url).toBe(r.body.logo_url);
    const ap = await req('POST', `/api/v1/admin/team-requests/${p.id}/approve`, { token: adm.token });
    expect(ap.status).toBe(201);
    expect((await req('GET', `/api/v1/teams/${ap.body.id}`)).body.logo_url).toBe(r.body.logo_url);
  });
});

describe('torneos', () => {
  it('modos de juego: público, admin y validación al crear', async () => {
    const pub = await req('GET', '/api/v1/game-modes');
    expect(pub.body.map((m: { code: string }) => m.code)).toContain('5v5');
    expect((await req('GET', '/api/v1/admin/game-modes', { token: org.token })).status).toBe(403);
    const off = await req('PUT', '/api/v1/admin/game-modes', { token: adm.token, body: { code: '1v1', active: false } });
    expect(off.body.find((m: { code: string }) => m.code === '1v1').active).toBe(false);
    try {
      expect((await req('GET', '/api/v1/game-modes')).body.some((m: { code: string }) => m.code === '1v1')).toBe(false);
      expect((await req('POST', '/api/v1/events', { token: org.token, body: { name: `X ${rnd()}`, template: 'single', game_mode: '1v1' } })).status).toBe(400);
    } finally {
      await req('PUT', '/api/v1/admin/game-modes', { token: adm.token, body: { code: '1v1', active: true } });
    }
  });

  it('inscripción con activos y suplentes, coach afuera, avisos y cierre de inscripciones', async () => {
    const created = await req('POST', '/api/v1/events', {
      token: org.token,
      body: { name: `Copa ${rnd()}`, template: 'single', game_mode: '2v2', subs_max: 1, config: { bo: 1, bo_semi: 1, bo_final: 3 } },
    });
    expect(created.status).toBe(201);
    const ev = created.body.id as string;
    const t = await team(1);
    const sub = await player();
    const coach = await player();
    const sb = admin();
    await sb.from('team_members').insert([
      { team_id: t.id, player_id: sub.player, role: 'sub', joined_at: new Date().toISOString() },
      { team_id: t.id, player_id: coach.player, role: 'coach', joined_at: new Date().toISOString() },
    ]);
    const url = `/api/v1/events/${ev}/registrations/${t.id}`;
    expect((await req('PUT', url, { token: t.cap.token, body: { active: [t.players[0]] } })).body.error.code).toBe('BUSINESS_RULE');
    const c1 = await req('PUT', url, { token: t.cap.token, body: { active: t.players, subs: [coach.player] } });
    expect(c1).toMatchObject({ status: 400, body: { error: { code: 'COACH_NOT_ALLOWED' } } });
    await sb.from('players').update({ steam_id: null }).eq('id', sub.player);
    const ns = await req('PUT', url, { token: t.cap.token, body: { active: t.players, subs: [sub.player] } });
    expect(ns).toMatchObject({ status: 400, body: { error: { code: 'PLAYER_NOT_LINKED', details: { aliases: [sub.tag] } } } });
    await sb.from('players').update({ steam_id: steam() }).eq('id', sub.player);
    expect((await req('PUT', url, { token: t.cap.token, body: { active: t.players, subs: [sub.player] } })).status).toBe(204);

    const regs = await req('GET', `/api/v1/events/${ev}/registrations`);
    expect(regs.body.items[0].team).toHaveProperty('logo_url', null);
    expect(regs.body.items[0].players.map((x: { role: string }) => x.role)).toEqual(['active', 'active', 'sub']);
    const avisos = await req('GET', '/api/v1/notifications', { token: sub.token });
    expect(avisos.body.items.some((n: { type: string; data: { role: string } }) => n.type === 'event_lineup' && n.data.role === 'sub')).toBe(true);

    const d = await req('GET', `/api/v1/events/${ev}`);
    expect(d.body).toMatchObject({ game_mode: '2v2', players_per_team: 2, subs_max: 1, bo: 1, bo_final: 3, current_stage: null, progress: null, live_match: null, banner_url: null });
    expect(d.body).not.toHaveProperty('players_min');

    // Cierre en el pasado: el capitán ya no cambia ni da de baja; el organizador sí.
    expect((await req('PATCH', `/api/v1/events/${ev}`, { token: org.token, body: { registration_closes_at: new Date(Date.now() - 60_000).toISOString() } })).status).toBe(204);
    const closed = await req('PUT', url, { token: t.cap.token, body: { active: t.players } });
    expect(closed).toMatchObject({ status: 409, body: { error: { code: 'REGISTRATION_CLOSED' } } });
    expect((await req('DELETE', url, { token: t.cap.token })).status).toBe(409);
    expect((await req('PUT', url, { token: org.token, body: { active: t.players } })).status).toBe(204);

    const hist = await req('GET', `/api/v1/teams/${t.id}/events`);
    expect(hist.body).toMatchObject({ total: 1, items: [{ event: { id: ev }, result: 'registered', place: null }] });
  });

  it('banner: lo sube el organizador, con medidas 4:1, y sale en el listado', async () => {
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Banner ${rnd()}`, template: 'single' } })).body.id as string;
    expect((await req('PUT', `/api/v1/events/${ev}/banner`, { token: org.token, form: form({ file: png(800, 400) }) })).status).toBe(400);
    const otro = await player();
    expect((await req('PUT', `/api/v1/events/${ev}/banner`, { token: otro.token, form: form({ file: png(1600, 400) }) })).status).toBe(403);
    const up = await req('PUT', `/api/v1/events/${ev}/banner`, { token: org.token, form: form({ file: png(1600, 400) }) });
    expect(up.status).toBe(200);
    expect(up.body.banner_url).toContain(`/photos/events/${ev}/`);
    const l = await req('GET', `/api/v1/events?q=${encodeURIComponent('Banner')}&per=100`);
    expect(l.body.items.find((e: { id: string }) => e.id === ev)).toMatchObject({ banner_url: up.body.banner_url, game_mode: '5v5' });
    expect((await req('DELETE', `/api/v1/events/${ev}/banner`, { token: org.token })).status).toBe(204);
  });
});
