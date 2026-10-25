import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

// Las pruebas usan el catálogo de mapas del replanteo 10 (8 mapas, Inferno con dos versiones) y dejan el que había.
const SEED = [
  ['de_dust2_ob'], ['de_cache'], ['de_cbble'], ['de_inferno', 'de_inferno_classic'], ['de_mirage_rc1'], ['de_nuke_old_blue'], ['de_season'], ['de_tuscan'],
].map((versions, i) => ({ name: versions[0]!, versions, position: i + 1, active: true, mixes: true, veto_default: true }));
let poolBefore: Record<string, unknown>[] = [];
async function setPool(rows: Record<string, unknown>[]) {
  const sb = admin();
  const del = await sb.from('map_pool').delete().not('name', 'is', null);
  if (del.error) throw del.error;
  const ins = await sb.from('map_pool').insert(rows);
  if (ins.error) throw ins.error;
}

let adm: U;
let org: U;
beforeAll(async () => {
  poolBefore = (await admin().from('map_pool').select('*')).data ?? [];
  await setPool(SEED);
  adm = await createUser({ role: 'admin' });
  org = await createUser({ tag: `Org${rnd()}` });
  expect((await req('PUT', `/api/v1/admin/users/${org.id}/role`, { token: adm.token, body: { role: 'organizer' } })).status).toBe(204);
});

afterAll(async () => {
  if (poolBefore.length) await setPool(poolBefore);
});

describe('torneo de punta a punta', () => {
  it('el organizador crea, los capitanes inscriben, el servidor manda resultados y la llave avanza sola', async () => {
    // Un usuario común no crea torneos.
    const nadie = await createUser();
    expect((await req('POST', '/api/v1/events', { token: nadie.token, body: { name: 'No', template: 'single' } })).status).toBe(403);

    const evName = `Copa ${rnd()}`;
    const created = await req('POST', '/api/v1/events', { token: org.token, body: { name: evName, template: 'single', config: { bo: 1, bo_semi: 1, bo_final: 1 }, players_max: 5 } });
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
    const regs = await req('GET', `/api/v1/events/${ev}/registrations`);
    expect(regs.body).toMatchObject({ total: 3, sort: 'seed', order: 'asc' });
    expect(regs.body.items[0]).toMatchObject({ seed: 1, team: { id: teams[2]!.id } });
    expect(regs.body.items[0].players).toHaveLength(5);
    expect((await req('GET', `/api/v1/events/${ev}/registrations?sort=seed&order=desc&per=1`)).body.items[0].seed).toBe(3);
    let ms = await req('GET', `/api/v1/events/${ev}/matches`);
    // 3 equipos: el cabeza de serie pasa por bye a la final; se juega una semifinal.
    const semi = ms.body.items.find((m: { label: string }) => m.label === 'Semifinal');
    const final = ms.body.items.find((m: { label: string }) => m.label === 'Final');
    // Con los byes, la llave completa: 2 semifinales (una con bye) y la final.
    expect((await req('GET', `/api/v1/events/${ev}/matches?include_byes=true`)).body.total).toBe(3);
    expect(final.side1.team.id).toBe(teams[2]!.id);

    // ETag: la misma consulta responde 304 (en el detalle y en las partidas).
    expect((await req('GET', `/api/v1/events/${ev}`, { headers: { 'If-None-Match': d.etag! } })).status).toBe(304);
    expect((await req('GET', `/api/v1/events/${ev}/matches`, { headers: { 'If-None-Match': ms.etag! } })).status).toBe(304);

    // La semifinal la "manda el servidor": termina con ganador y la final se completa sola.
    const r1 = await admin().from('matches').update({ status: 'finished', winner: semi.side1.team.id, score1: 1, score2: 0, maps: [{ map: 'de_dust2_ob', r1: 16, r2: 10 }] }).eq('id', semi.id);
    expect(r1.error).toBeNull();
    ms = await req('GET', `/api/v1/events/${ev}/matches?stage=ko&round=2`);
    expect(ms.body.items.map((m: { id: string }) => m.id)).toEqual([final.id]);
    expect(ms.body.items[0].side2.team.id).toBe(semi.side1.team.id);

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
    const list = await req('GET', `/api/v1/events?status=finished&organizer=${org.id}&q=${encodeURIComponent(evName.toLowerCase())}`);
    expect(list.body.items).toEqual([expect.objectContaining({ id: ev, champion: expect.objectContaining({ id: teams[2]!.id }) })]);
    expect((await req('GET', `/api/v1/events?status=registration&q=${encodeURIComponent(evName)}`)).body.total).toBe(0);
    // La partida del jugador campeón aparece filtrando por jugador.
    const byPlayer = await req('GET', `/api/v1/matches?event=${ev}&team=${teams[2]!.id}`);
    expect(byPlayer.body.total).toBe(1);
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

describe('tablas de grupos y stats por mapa', () => {
  it('grupos: tabla con posición, filtros y ETag', async () => {
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Grupos ${rnd()}`, template: 'groups', config: { groups: 1, advance: 1 }, players_max: 5 } })).body.id;
    const ts = await Promise.all([team(), team(), team()]);
    for (const t of ts) await req('PUT', `/api/v1/events/${ev}/registrations/${t.id}`, { token: t.cap.token, body: { players: t.players } });
    expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token })).status).toBe(204);
    const st = await req('GET', `/api/v1/events/${ev}/standings?stage=group&grp=1`);
    expect(st.body).toMatchObject({ total: 3, sort: 'place', order: 'asc' });
    expect(st.body.items.map((r: { place: number }) => r.place)).toEqual([1, 2, 3]);
    expect(st.body.items[0]).toMatchObject({ stage: 'group', grp: 1, played: 0, points: 0 });
    expect((await req('GET', `/api/v1/events/${ev}/standings`, { headers: { 'If-None-Match': st.etag! } })).status).toBe(304);
    expect((await req('GET', `/api/v1/events/${ev}/standings?stage=swiss`)).body.total).toBe(0);
    expect((await req('GET', `/api/v1/events/${ev}/matches?stage=group&round=1`)).body.total).toBe(1);
  });

  it('stats por mapa de un jugador', async () => {
    const sb = admin();
    const pl = (await sb.from('players').insert({ nick: `Map${rnd()}`, steam_id: steam() }).select('id, steam_id').single()).data!;
    for (const map of ['de_cbble', 'de_cbble', 'de_tuscan']) {
      const m = (await sb.from('matches').insert({ kind: 'mix', status: 'finished', map, side1_name: 'A', side2_name: 'B', winner_side: 1, played_at: new Date().toISOString() }).select('id').single()).data!.id;
      await sb.from('match_player_stats').insert({ match_id: m, steam_id: pl.steam_id, player_id: pl.id, team: 1, nick: 'x', kills: 10, deaths: 5, rounds: 20 });
    }
    const ms = await req('GET', `/api/v1/players/${pl.id}/map-stats`);
    expect(ms.body).toMatchObject({ total: 2, sort: 'maps', order: 'desc' });
    expect(ms.body.items[0]).toMatchObject({ map: 'de_cbble', maps: 2 });
    expect((await req('GET', `/api/v1/players/${pl.id}/map-stats?map=tusc`)).body.items).toEqual([expect.objectContaining({ map: 'de_tuscan', maps: 1 })]);
    expect((await req('GET', `/api/v1/players/${pl.id}/matches?map=tuscan&result=won`)).body.total).toBe(1);
    expect((await req('GET', `/api/v1/players/${pl.id}/matches?result=lost`)).body.total).toBe(0);
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
    expect(pool.body.items).toContainEqual({
      name: 'de_inferno', versions: ['de_inferno', 'de_inferno_classic'], active: true, position: 4, mixes: true, veto_default: true, image_url: null,
    });

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

    expect((await req('POST', `/api/v1/matches/${m.id}/chat`, { token: t1.cap.token, body: { message: 'suerte' } })).status).toBe(201);
    const chat = await req('GET', `/api/v1/matches/${m.id}/chat?limit=1`);
    expect(chat.body).toMatchObject({ has_more: true, limit: 1, items: [expect.objectContaining({ message: 'suerte', user_id: t1.cap.id })] });
    const older = await req('GET', `/api/v1/matches/${m.id}/chat?before=${chat.body.items[0].id}`);
    expect(older.body).toMatchObject({ has_more: false, items: [expect.objectContaining({ message: 'gl hf', user_id: t2.cap.id })] });
    expect((await req('GET', `/api/v1/matches/${m.id}/chat?after=${chat.body.items[0].id}`)).body).toMatchObject({ items: [], has_more: false });

    // El organizador reinicia el veto y asigna servidor y hora.
    expect((await req('DELETE', `/api/v1/matches/${m.id}/veto`, { token: t1.cap.token })).status).toBe(403);
    expect((await req('DELETE', `/api/v1/matches/${m.id}/veto`, { token: org.token })).status).toBe(204);
    const srv = (await admin().from('game_servers').insert({ name: `srv ${rnd()}`, token_hash: rnd(), active: true, connect_address: '1.2.3.4:27015' }).select('id').single()).data!.id;
    const servers = await req('GET', '/api/v1/servers?per=100', { token: org.token });
    expect(servers.body.items).toContainEqual({ id: srv, name: expect.any(String), address: '1.2.3.4:27015' });
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
    const list = await req('GET', `/api/v1/matches?kind=mix&player=${pl.id}`);
    expect(list.body.items.map((x: { id: string }) => x.id)).toEqual([m]);
  });
});

describe('PCW', () => {
  it('publicar como equipo, aceptar, mis PCW, cancelar y resultado del admin', async () => {
    const [a, b] = await Promise.all([team(), team()]);
    const post = await req('POST', '/api/v1/pcw/posts', { token: a.cap.token, body: { best_of: 1, players: a.players.slice(0, 4), guests: ['Suplente'], team_id: a.id } });
    expect(post.status).toBe(201);
    const open = await req('GET', '/api/v1/pcw/posts?best_of=1&per=100');
    const mine = open.body.items.find((p: { id: string }) => p.id === post.body.id);
    expect(mine.side).toMatchObject({ plays_as: { id: a.id } });
    expect(mine.side.roster).toHaveLength(5);
    // Otro no puede jugar como un equipo ajeno.
    expect((await req('POST', `/api/v1/pcw/posts/${post.body.id}/accept`, { token: b.cap.token, body: { players: b.players.slice(0, 4), team_id: a.id } })).status).toBe(403);
    const acc = await req('POST', `/api/v1/pcw/posts/${post.body.id}/accept`, { token: b.cap.token, body: { players: b.players.slice(0, 4) } });
    expect(acc.status).toBe(201);
    expect((await req('GET', '/api/v1/me/pcw/post', { token: a.cap.token })).body).toBeNull();
    const my = await req('GET', '/api/v1/me/pcw/matches?status=upcoming', { token: a.cap.token });
    expect(my.body.items.map((x: { id: string }) => x.id)).toEqual([acc.body.id]);
    // El resultado a mano de una PCW es solo del admin.
    expect((await req('POST', `/api/v1/admin/pcw/matches/${acc.body.id}/result`, { token: a.cap.token, body: { maps: [{ r1: 16, r2: 2 }] } })).status).toBe(403);
    expect((await req('POST', `/api/v1/admin/pcw/matches/${acc.body.id}/result`, { token: adm.token, body: { maps: [{ map: 'de_cbble', r1: 16, r2: 2 }] } })).status).toBe(204);
    // Suma al ranking del equipo con pcw=1.
    const rk = await req('GET', `/api/v1/ranking/teams?pcw=1&q=${encodeURIComponent(a.name)}`);
    expect(rk.body.items.find((i: { team: { id: string } }) => i.team.id === a.id)).toMatchObject({ won: 1, points: 5 });

    // Otra PCW: se cancela antes de jugar.
    const p2 = await req('POST', '/api/v1/pcw/posts', { token: a.cap.token, body: { best_of: 1, players: a.players.slice(0, 4) } });
    expect((await req('DELETE', `/api/v1/pcw/posts/${p2.body.id}`, { token: b.cap.token })).status).toBe(400);
    expect((await req('DELETE', `/api/v1/pcw/posts/${p2.body.id}`, { token: a.cap.token })).status).toBe(204);
  });

  it('admin: pool de mapas y roles', async () => {
    const before = (await req('GET', '/api/v1/maps')).body.items;
    const maps = before.map((m: { name: string; versions: string[] }) => ({ name: m.name, versions: m.versions, active: m.name !== 'de_season', veto_default: m.name !== 'de_season' }));
    expect((await req('PUT', '/api/v1/admin/maps', { token: org.token, body: { maps } })).status).toBe(403);
    expect((await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps } })).status).toBe(204);
    expect((await req('GET', '/api/v1/maps')).body.items.map((m: { name: string }) => m.name)).not.toContain('de_season');
    expect((await req('GET', '/api/v1/maps?include_inactive=true&q=season')).body.items).toEqual([expect.objectContaining({ name: 'de_season', active: false })]);
    // Un mapa no se borra: si falta en la lista, 400.
    const short = await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps: maps.slice(1) } });
    expect(short.status).toBe(400);
    expect(short.body.error.message).toContain('Faltan: de_dust2_ob');
    // Retirado y en el pool por defecto: 400.
    const bad = maps.map((m: { name: string }) => (m.name === 'de_season' ? { ...m, veto_default: true } : m));
    expect((await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps: bad } })).status).toBe(400);
    expect((await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps: before.map((m: { name: string; versions: string[] }) => ({ name: m.name, versions: m.versions, active: true, veto_default: true })) } })).status).toBe(204);
    expect((await req('GET', '/api/v1/maps?mixes=true')).body.total).toBe(8);
    expect((await req('PUT', `/api/v1/admin/users/${adm.id}/role`, { token: adm.token, body: { role: 'user' } })).status).toBe(400);
    expect((await req('GET', '/auth/me', { token: org.token })).body.role).toBe('organizer');
  });
});

describe('catálogo de mapas: pools propios y foto', () => {
  it('torneo con pool propio: el veto usa ese pool, que no cambia después del primer veto', async () => {
    // de_russka: disponible, fuera del pool por defecto y de Mixes.
    expect((await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps: [...SEED, { name: 'de_russka', active: true, mixes: false, veto_default: false }] } })).status).toBe(204);
    expect((await req('GET', '/api/v1/maps?veto_default=true')).body.items.map((m: { name: string }) => m.name)).not.toContain('de_russka');

    const body = { name: `Pool ${rnd()}`, template: 'single', config: { bo: 1, bo_semi: 1, bo_final: 1, bo_third: 1 }, players_max: 5 };
    expect((await req('POST', '/api/v1/events', { token: org.token, body: { ...body, map_pool: ['de_russka', 'de_nope'] } })).body.error.message).toBe('El mapa de_nope no está disponible');
    const ev = (await req('POST', '/api/v1/events', { token: org.token, body: { ...body, map_pool: ['de_russka', 'de_cache', 'de_tuscan'] } })).body.id;
    expect((await req('GET', `/api/v1/events/${ev}`)).body.map_pool).toEqual(['de_russka', 'de_cache', 'de_tuscan']);
    const [a, b] = await Promise.all([team(), team()]);
    for (const t of [a, b]) await req('PUT', `/api/v1/events/${ev}/registrations/${t.id}`, { token: t.cap.token, body: { players: t.players } });
    await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token });
    const m = (await req('GET', `/api/v1/matches?event=${ev}`)).body.items[0];
    const t1 = m.side1.team.id === a.id ? a : b;

    const d = await req('GET', `/api/v1/matches/${m.id}`, { token: t1.cap.token });
    expect(d.body.veto.pool.map((x: { name: string }) => x.name)).toEqual(['de_cache', 'de_tuscan', 'de_russka']);
    expect(d.body.veto.sequence).toEqual(['ban', 'ban']);
    const v = (map: string) => req('POST', `/api/v1/matches/${m.id}/veto`, { token: t1.cap.token, body: { map } });
    expect((await v('de_dust2_ob')).body.error.message).toBe('Ese mapa no está en el pool');
    expect((await v('de_russka')).status).toBe(204);
    const change = await req('PATCH', `/api/v1/events/${ev}`, { token: org.token, body: { map_pool: ['de_cache', 'de_tuscan', 'de_cbble'] } });
    expect(change.body.error.message).toBe('El pool de mapas del torneo no se cambia después del primer veto');
    expect((await req('PUT', '/api/v1/admin/maps', { token: adm.token, body: { maps: [...SEED, { name: 'de_russka', active: false, mixes: false, veto_default: false }] } })).status).toBe(204);
  });

  it('PCW con pool propio: al menos su BO, y el veto de la partida lo usa', async () => {
    const [a, b] = await Promise.all([team(), team()]);
    const short = await req('POST', '/api/v1/pcw/posts', { token: a.cap.token, body: { best_of: 3, players: a.players.slice(0, 4), map_pool: ['de_cache', 'de_cbble'] } });
    expect(short.body.error.message).toBe('El pool de mapas necesita al menos 3 mapas (el BO más alto)');
    const post = await req('POST', '/api/v1/pcw/posts', { token: a.cap.token, body: { best_of: 1, players: a.players.slice(0, 4), map_pool: ['de_cache', 'de_cbble'] } });
    expect(post.status).toBe(201);
    const listed = (await req('GET', '/api/v1/pcw/posts?per=100')).body.items.find((p: { id: string }) => p.id === post.body.id);
    expect(listed.map_pool).toEqual(['de_cache', 'de_cbble']);
    const acc = await req('POST', `/api/v1/pcw/posts/${post.body.id}/accept`, { token: b.cap.token, body: { players: b.players.slice(0, 4) } });
    const d = await req('GET', `/api/v1/matches/${acc.body.id}`, { token: a.cap.token });
    expect(d.body.veto.pool.map((x: { name: string }) => x.name)).toEqual(['de_cache', 'de_cbble']);
    expect(d.body.veto.sequence).toEqual(['ban']);
    expect((await req('POST', `/api/v1/pcw/matches/${acc.body.id}/cancel`, { token: a.cap.token })).status).toBe(204);
  });

  it('foto de un mapa: se sube al bucket, reemplaza a la anterior y se quita', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (ch) => ch.charCodeAt(0));
    const up = (token = adm.token) => {
      const fd = new FormData();
      fd.append('file', new File([png], 'a.png', { type: 'image/png' }));
      return app.request('/api/v1/admin/maps/de_tuscan/image', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }, env);
    };
    const files = async () => (await admin().storage.from('photos').list('maps/de_tuscan')).data ?? [];
    expect((await up(org.token)).status).toBe(403);
    const first = await up();
    expect(first.status).toBe(200);
    const url = (await first.json()).image_url as string;
    expect(url).toContain('/photos/maps/de_tuscan/');
    expect((await fetch(url)).status).toBe(200);
    const second = (await (await up()).json()).image_url as string;
    expect(second).not.toBe(url);
    await new Promise((r) => setTimeout(r, 300));
    expect((await files()).length).toBe(1);
    expect((await req('GET', '/api/v1/maps?q=tuscan')).body.items[0].image_url).toBe(second);
    const gone = await req('DELETE', '/api/v1/admin/maps/de_tuscan/image', { token: adm.token });
    expect(gone.body.image_url).toBeNull();
    await new Promise((r) => setTimeout(r, 300));
    expect((await files()).length).toBe(0);
    expect((await req('DELETE', '/api/v1/admin/maps/de_nope/image', { token: adm.token })).status).toBe(404);
  });
});
