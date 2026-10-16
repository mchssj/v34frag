import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Partidas, torneos y PCW contra la Supabase local (con el replanteo 10 aplicado).
const app = createApp();
const env = localEnv({ DEMO_BASE_URL: 'https://demos.test' });
type U = Awaited<ReturnType<typeof createUser>>;

const rnd = () => Math.random().toString(36).slice(2, 8);
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

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

/** Equipo oficial con capitán (usuario con jugador) y 5 jugadores con SteamID en total. */
async function team() {
  const cap = await createUser({ tag: `Cap${rnd()}` });
  const sb = admin();
  const t = (await sb.from('teams').insert({ name: `T ${rnd()}`, tag: 'T', kind: 'official', captain_id: cap.id, owner_id: cap.id }).select('id, name').single()).data!;
  const capPlayer = (await sb.from('players').insert({ nick: 'x', user_id: cap.id, steam_id: steam() }).select('id').single()).data!.id as string;
  const others = (await sb.from('players').insert(Array.from({ length: 4 }, (_, i) => ({ nick: `J${i}${rnd()}`, steam_id: steam() }))).select('id')).data!.map((p) => p.id as string);
  const players = [capPlayer, ...others];
  const r = await sb.from('team_members').insert(players.map((p) => ({ team_id: t.id, player_id: p, joined_at: new Date().toISOString() })));
  if (r.error) throw r.error;
  return { id: t.id as string, name: t.name as string, cap, players };
}

let adm: U;
let org: U;
beforeAll(async () => {
  adm = await createUser({ role: 'admin' });
  org = await createUser({ tag: `Org${rnd()}` });
  expect((await req('PUT', `/api/v1/admin/users/${org.id}/role`, { token: adm.token, body: { role: 'organizer' } })).status).toBe(204);
});

describe('torneo de punta a punta', () => {
  it('el organizador crea, los capitanes inscriben, el servidor manda resultados y la llave avanza sola', async () => {
    // Un usuario común no crea torneos.
    const nadie = await createUser();
    expect((await req('POST', '/api/v1/events', { token: nadie.token, body: { name: 'No', template: 'single' } })).status).toBe(403);

    const created = await req('POST', '/api/v1/events', { token: org.token, body: { name: `Copa ${rnd()}`, template: 'single', config: { bo: 1, bo_semi: 1, bo_final: 1 }, players_max: 5 } });
    expect(created.status).toBe(201);
    const ev = created.body.id as string;
    expect((await req('PATCH', `/api/v1/events/${ev}`, { token: nadie.token, body: { name: 'Robado' } })).status).toBe(403);

    const teams = await Promise.all([team(), team(), team()]);
    for (const t of teams) {
      const r = await req('PUT', `/api/v1/events/${ev}/registrations/${t.id}`, { token: t.cap.token, body: { players: t.players } });
      expect(r.status).toBe(204);
    }
    // Otro capitán no puede inscribir un equipo ajeno.
    expect((await req('PUT', `/api/v1/events/${ev}/registrations/${teams[0]!.id}`, { token: teams[1]!.cap.token, body: { players: teams[0]!.players } })).status).toBe(403);
    // La siembra: el tercero primero.
    expect((await req('PUT', `/api/v1/events/${ev}/seeds`, { token: org.token, body: { teams: [teams[2]!.id, teams[0]!.id, teams[1]!.id] } })).status).toBe(204);
    expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token })).status).toBe(204);

    let d = await req('GET', `/api/v1/events/${ev}`);
    expect(d.body).toMatchObject({ status: 'in_progress', template: 'single', teams: 3, players_min: 5, players_max: 5 });
    expect(d.body.registrations[0]).toMatchObject({ seed: 1, team: { id: teams[2]!.id } });
    expect(d.body.registrations[0].players).toHaveLength(5);
    // 3 equipos: el cabeza de serie pasa por bye a la final; se juega una semifinal.
    const semi = d.body.matches.find((m: { label: string }) => m.label === 'Semifinal');
    const final = d.body.matches.find((m: { label: string }) => m.label === 'Final');
    expect(final.side1.team.id).toBe(teams[2]!.id);

    // ETag: la misma consulta responde 304.
    expect((await req('GET', `/api/v1/events/${ev}`, { headers: { 'If-None-Match': d.etag! } })).status).toBe(304);

    // La semifinal la "manda el servidor": termina con ganador y la final se completa sola.
    const r1 = await admin().from('matches').update({ status: 'finished', winner: semi.side1.team.id, score1: 1, score2: 0, maps: [{ map: 'de_dust2_ob', r1: 16, r2: 10 }] }).eq('id', semi.id);
    expect(r1.error).toBeNull();
    d = await req('GET', `/api/v1/events/${ev}`);
    expect(d.body.matches.find((m: { id: string }) => m.id === final.id).side2.team.id).toBe(semi.side1.team.id);

    // La final la carga el organizador a mano (por ejemplo, se cayó el servidor).
    expect((await req('POST', `/api/v1/matches/${final.id}/result`, { token: nadie.token, body: { maps: [{ map: 'de_cbble', r1: 16, r2: 5 }] } })).status).toBe(403);
    const bad = await req('POST', `/api/v1/matches/${final.id}/result`, { token: org.token, body: { maps: [{ map: 'de_cbble', r1: 15, r2: 15 }] } });
    expect(bad.body.error).toMatchObject({ code: 'BUSINESS_RULE', message: 'Un mapa no puede terminar empatado (se juega overtime)' });
    expect((await req('POST', `/api/v1/matches/${final.id}/result`, { token: org.token, body: { maps: [{ map: 'de_cbble', r1: 16, r2: 5 }] } })).status).toBe(204);
    d = await req('GET', `/api/v1/events/${ev}`);
    expect(d.body).toMatchObject({ status: 'finished', champion: { id: teams[2]!.id } });

    // El ranking cuenta las partidas de torneo; con jugadas no se borra ni se reinicia.
    expect((await req('POST', `/api/v1/events/${ev}/reset`, { token: org.token })).body.error.message).toBe('Ya se jugaron partidas: el fixture no se puede reiniciar');
    expect((await req('DELETE', `/api/v1/events/${ev}`, { token: org.token })).status).toBe(400);
    const list = await req('GET', '/api/v1/events?status=finished');
    expect(list.body.items).toContainEqual(expect.objectContaining({ id: ev, champion: expect.objectContaining({ id: teams[2]!.id }) }));
  });

  it('un jugador no se inscribe con dos equipos en el mismo torneo', async () => {
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Doble ${rnd()}`, template: 'double' } })).body.id;
    const [a, b] = await Promise.all([team(), team()]);
    const shared = a.players[1]!;
    await admin().from('team_members').insert({ team_id: b.id, player_id: shared, joined_at: new Date().toISOString() });
    expect((await req('PUT', `/api/v1/events/${ev}/registrations/${a.id}`, { token: a.cap.token, body: { players: a.players } })).status).toBe(204);
    const clash = await req('PUT', `/api/v1/events/${ev}/registrations/${b.id}`, { token: b.cap.token, body: { players: [...b.players.slice(0, 4), shared] } });
    expect(clash.body.error.code).toBe('BUSINESS_RULE');
    expect(clash.body.error.message).toMatch(/ya está inscrito en este torneo con /);
    expect((await req('PUT', `/api/v1/events/${ev}/registrations/${b.id}`, { token: b.cap.token, body: { players: b.players } })).status).toBe(204);
    expect((await req('DELETE', `/api/v1/events/${ev}/registrations/${b.id}`, { token: b.cap.token })).status).toBe(204);
    expect((await req('DELETE', `/api/v1/events/${ev}`, { token: org.token })).status).toBe(204);
  });
});

describe('partida: detalle, veto, chat y código', () => {
  it('veto por turnos con versión de Inferno, chat de participantes y código solo para ellos', async () => {
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Veto ${rnd()}`, template: 'single', config: { bo_final: 3 }, players_max: 5 } })).body.id;
    const [a, b] = await Promise.all([team(), team()]);
    for (const t of [a, b]) await req('PUT', `/api/v1/events/${ev}/registrations/${t.id}`, { token: t.cap.token, body: { players: t.players } });
    await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token });
    const m = (await req('GET', `/api/v1/matches?event=${ev}`)).body.items[0];
    const t1 = m.side1.team.id === a.id ? a : b;
    const t2 = t1 === a ? b : a;

    const pool = await req('GET', '/api/v1/maps');
    expect(pool.body).toContainEqual({ name: 'de_inferno', versions: ['de_inferno', 'de_inferno_classic'] });

    let d = await req('GET', `/api/v1/matches/${m.id}`, { token: t1.cap.token });
    expect(d.body.veto.sequence).toEqual(['ban', 'ban', 'pick', 'pick', 'ban', 'ban', 'ban']);
    expect(d.body.viewer).toMatchObject({ can_veto: true, can_chat: true, can_manage: false, is_participant: true });
    expect(d.body.link_code).toMatch(/^[A-Z2-9]{5}$/);
    expect(d.body.roster1).toHaveLength(5);
    // Un extraño no ve el código ni puede escribir.
    const extra = await createUser();
    const ext = await req('GET', `/api/v1/matches/${m.id}`, { token: extra.token });
    expect(ext.body.link_code).toBeNull();
    expect((await req('POST', `/api/v1/matches/${m.id}/chat`, { token: extra.token, body: { message: 'hola' } })).status).toBe(403);
    expect((await req('POST', `/api/v1/matches/${m.id}/chat`, { token: t2.cap.token, body: { message: 'gl hf' } })).status).toBe(201);

    const v = (token: string, map: string, version?: string) => req('POST', `/api/v1/matches/${m.id}/veto`, { token, body: { map, ...(version ? { version } : {}) } });
    expect((await v(t2.cap.token, 'de_cache')).status).toBe(403);
    expect((await v(t1.cap.token, 'de_cache')).status).toBe(204);
    expect((await v(t2.cap.token, 'de_season')).status).toBe(204);
    expect((await v(t1.cap.token, 'de_inferno')).body.error.message).toBe('Elegí la versión del mapa: de_inferno o de_inferno_classic');
    expect((await v(t1.cap.token, 'de_inferno', 'de_inferno_classic')).status).toBe(204);
    expect((await v(t2.cap.token, 'de_nuke_old_blue')).status).toBe(204);
    for (const [tok, map] of [[t1.cap.token, 'de_tuscan'], [t2.cap.token, 'de_cbble'], [t1.cap.token, 'de_mirage_rc1']] as const) {
      expect((await v(tok, map)).status).toBe(204);
    }
    d = await req('GET', `/api/v1/matches/${m.id}`);
    expect(d.body.veto.next).toBeNull();
    expect(d.body.veto.maps_to_play).toEqual([
      { map: 'de_inferno', version: 'de_inferno_classic', decider: false },
      { map: 'de_nuke_old_blue', version: 'de_nuke_old_blue', decider: false },
      { map: 'de_dust2_ob', version: 'de_dust2_ob', decider: true },
    ]);

    const chat = await req('GET', `/api/v1/matches/${m.id}/chat`);
    expect(chat.body).toEqual([expect.objectContaining({ message: 'gl hf', user_id: t2.cap.id })]);
    expect((await req('GET', `/api/v1/matches/${m.id}/chat?after=${chat.body[0].id}`)).body).toEqual([]);

    // El organizador reinicia el veto y asigna servidor y hora.
    expect((await req('DELETE', `/api/v1/matches/${m.id}/veto`, { token: t1.cap.token })).status).toBe(403);
    expect((await req('DELETE', `/api/v1/matches/${m.id}/veto`, { token: org.token })).status).toBe(204);
    const srv = (await admin().from('game_servers').insert({ name: `srv ${rnd()}`, token_hash: rnd(), active: true, connect_address: '1.2.3.4:27015' }).select('id').single()).data!.id;
    const servers = await req('GET', '/api/v1/servers', { token: org.token });
    expect(servers.body).toContainEqual({ id: srv, name: expect.any(String), address: '1.2.3.4:27015' });
    expect((await req('GET', '/api/v1/servers', { token: extra.token })).status).toBe(403);
    expect((await req('PATCH', `/api/v1/matches/${m.id}`, { token: org.token, body: { server_id: srv, starts_at: '2026-11-01T20:00:00Z' } })).status).toBe(204);
    d = await req('GET', `/api/v1/matches/${m.id}`);
    expect(d.body.server).toEqual({ id: srv, name: expect.any(String), address: '1.2.3.4:27015' });
    expect(d.body.veto.actions).toEqual([]);

    // W.O.: avanza el que se presentó.
    expect((await req('POST', `/api/v1/matches/${m.id}/result`, { token: org.token, body: { walkover: t2.id } })).status).toBe(204);
    expect((await req('GET', `/api/v1/events/${ev}`)).body.champion.id).toBe(t2.id);
  });

  it('detalle de un mix con stats, MVP y demo', async () => {
    const sb = admin();
    const pl = (await sb.from('players').insert({ nick: `Mvp${rnd()}`, steam_id: steam() }).select('id, steam_id').single()).data!;
    const uid = `mix${rnd()}${rnd()}`;
    const m = (await sb.from('matches').insert({ kind: 'mix', status: 'finished', side1_name: 'A', side2_name: 'B', score1: 16, score2: 9, winner_side: 1, external_id: uid, demo_status: 'uploaded', played_at: new Date().toISOString() }).select('id').single()).data!.id;
    await sb.from('match_player_stats').insert([
      { match_id: m, steam_id: pl.steam_id, player_id: pl.id, team: 1, nick: 'en juego', kills: 25, deaths: 10, rounds: 25, rating: 1.6 },
      { match_id: m, steam_id: steam(), team: 2, nick: 'invitado', kills: 8, deaths: 20, rounds: 25, rating: 0.6 },
    ]);
    const d = await req('GET', `/api/v1/matches/${m}`);
    expect(d.body).toMatchObject({ kind: 'mix', side1: { name: 'A', score: 16 }, winner_side: 1, demo_url: `https://demos.test/demo/${uid}`, veto: null });
    expect(d.body.mvp).toMatchObject({ player_id: pl.id, game_nick: 'en juego' });
    expect(d.body.players).toHaveLength(2);
    const list = await req('GET', '/api/v1/matches?kind=mix&per=100');
    expect(list.body.items.some((x: { id: string }) => x.id === m)).toBe(true);
  });
});

describe('PCW', () => {
  it('publicar como equipo, aceptar, mis PCW, cancelar y resultado del admin', async () => {
    const [a, b] = await Promise.all([team(), team()]);
    const post = await req('POST', '/api/v1/pcw/posts', { token: a.cap.token, body: { best_of: 1, players: a.players.slice(0, 4), guests: ['Suplente'], team_id: a.id } });
    expect(post.status).toBe(201);
    const open = await req('GET', '/api/v1/pcw/posts');
    const mine = open.body.find((p: { id: string }) => p.id === post.body.id);
    expect(mine.side).toMatchObject({ plays_as: { id: a.id } });
    expect(mine.side.roster).toHaveLength(5);
    // Otro no puede jugar como un equipo ajeno.
    expect((await req('POST', `/api/v1/pcw/posts/${post.body.id}/accept`, { token: b.cap.token, body: { players: b.players.slice(0, 4), team_id: a.id } })).status).toBe(403);
    const acc = await req('POST', `/api/v1/pcw/posts/${post.body.id}/accept`, { token: b.cap.token, body: { players: b.players.slice(0, 4) } });
    expect(acc.status).toBe(201);
    const my = await req('GET', '/api/v1/me/pcw', { token: a.cap.token });
    expect(my.body.post).toBeNull();
    expect(my.body.matches.map((x: { id: string }) => x.id)).toContain(acc.body.id);
    // El resultado a mano de una PCW es solo del admin.
    expect((await req('POST', `/api/v1/admin/pcw/matches/${acc.body.id}/result`, { token: a.cap.token, body: { maps: [{ r1: 16, r2: 2 }] } })).status).toBe(403);
    expect((await req('POST', `/api/v1/admin/pcw/matches/${acc.body.id}/result`, { token: adm.token, body: { maps: [{ map: 'de_cbble', r1: 16, r2: 2 }] } })).status).toBe(204);
    // Suma al ranking del equipo con pcw=1.
    const rk = await req('GET', '/api/v1/ranking/teams?pcw=1');
    expect(rk.body.items.find((i: { team: { id: string } }) => i.team.id === a.id)).toMatchObject({ won: 1, points: 5 });

    // Otra PCW: se cancela antes de jugar.
    const p2 = await req('POST', '/api/v1/pcw/posts', { token: a.cap.token, body: { best_of: 1, players: a.players.slice(0, 4) } });
    expect((await req('DELETE', `/api/v1/pcw/posts/${p2.body.id}`, { token: b.cap.token })).status).toBe(400);
    expect((await req('DELETE', `/api/v1/pcw/posts/${p2.body.id}`, { token: a.cap.token })).status).toBe(204);
  });

  it('admin: pool de mapas y roles', async () => {
    const before = (await req('GET', '/api/v1/maps')).body;
    const maps = before.map((m: { name: string; versions: string[] }) => ({ name: m.name, versions: m.versions, active: m.name !== 'de_season' }));
    expect((await req('PUT', '/api/v1/admin/maps', { token: org.token, body: { maps } })).status).toBe(403);
    expect((await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps } })).status).toBe(204);
    expect((await req('GET', '/api/v1/maps')).body.map((m: { name: string }) => m.name)).not.toContain('de_season');
    expect((await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps: before.map((m: object) => ({ ...m, active: true })) } })).status).toBe(204);
    expect((await req('PUT', `/api/v1/admin/users/${adm.id}/role`, { token: adm.token, body: { role: 'user' } })).status).toBe(400);
    expect((await req('GET', '/auth/me', { token: org.token })).body.role).toBe('organizer');
  });
});
