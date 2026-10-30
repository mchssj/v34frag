import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Mixes, perfil público y ranking contra la Supabase local (replanteo 27, plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking).
const app = createApp();
const env = localEnv();
const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const serverId = crypto.randomUUID();
const playerIds = Array.from({ length: 6 }, () => crypto.randomUUID());
const mixIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const teamIds = [crypto.randomUUID(), crypto.randomUUID()];
const eventId = crypto.randomUUID();
let finalId: string;
let eloConfigBefore: unknown = null;
const liveUid = `mpr${sfx}-vivo`;
const steam = (i: number) => `7656119${(Number.parseInt(sfx.slice(-5), 36) % 1_000_000).toString().padStart(6, '0')}${(i + 5000).toString().padStart(4, '0')}`;
const nick = (i: number) => `Mpr${i}${sfx}`;
let adminToken: string;
let userToken: string;
let owner: { id: string; token: string };

const call = (method: string, path: string, body?: unknown, auth?: string) =>
  app.request(
    path,
    {
      method,
      headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const get = async (path: string, auth?: string) => {
  const res = await call('GET', path, undefined, auth);
  return { status: res.status, body: await res.json() };
};

async function insert(table: string, rows: unknown) {
  const r = await admin().from(table).insert(rows as never);
  if (r.error) throw r.error;
}

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  userToken = (await createUser()).token;
  // La ficha 0 es de una cuenta: su nick pasa a ser el alias de la cuenta.
  owner = await createUser({ tag: nick(0) });
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  // Revertir usa el piso de elo_config: la base local puede no tener la fila.
  eloConfigBefore = (await admin().from('elo_config').select('id').eq('id', 1).maybeSingle()).data;
  if (!eloConfigBefore) await insert('elo_config', [{ id: 1 }]);
  await insert('game_servers', [{ id: serverId, name: `Mpr ${sfx}`, token_hash: `h${sfx}`, connect_address: '10.9.9.9:27015', tv_port: 27020 }]);
  await insert('players', playerIds.map((id, i) => ({ id, nick: nick(i), steam_id: steam(i), ...(i === 0 ? { user_id: owner.id } : {}) })));
  // Dos mixes terminados (fichas 0-2 contra 3-5): el primero lo gana el bando 1, el segundo el 2. Y uno cancelado.
  await insert('matches', [
    { id: mixIds[0], kind: 'mix', status: 'finished', map: 'de_dust2', score1: 13, score2: 7, winner_side: 1, starts_at: day(3), played_at: day(3), server_id: serverId, side1_name: `Mix de A${sfx}`, side2_name: 'Mix de B', demo_status: 'uploaded', demo_size: 52_428_800 },
    { id: mixIds[1], kind: 'mix', status: 'finished', map: 'de_inferno', score1: 5, score2: 13, winner_side: 2, starts_at: day(2), played_at: day(2), server_id: serverId, side1_name: `Mix de A${sfx}`, side2_name: 'Mix de B', demo_status: 'none' },
    { id: mixIds[2], kind: 'mix', status: 'cancelled', map: 'de_dust2', score1: 1, score2: 0, starts_at: day(1), played_at: day(1), server_id: serverId, side1_name: `Mix de A${sfx}`, side2_name: 'Mix de B', cancel_reason: 'admin', demo_status: 'none' },
  ]);
  // Bando 1 (fichas 0-2): 1500 → 1520 → 1500. Bando 2 (3-5): 1500 → 1480 → 1500.
  const stats = [];
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? 1 : 2;
    const d = side === 1 ? 20 : -20;
    const base = { steam_id: steam(i), player_id: playerIds[i], team: side, nick: `g${i}${sfx}`, kills: 10 + i, deaths: 10, rounds: 20, rating: i === 4 ? 1.8 : 1 + i / 100 };
    stats.push({ ...base, match_id: mixIds[0], elo_before: 1500, elo_after: 1500 + d, elo_delta: d });
    stats.push({ ...base, match_id: mixIds[1], elo_before: 1500 + d, elo_after: 1500, elo_delta: -d });
  }
  await insert('match_player_stats', stats);
  // ELO actual (a mano, para tener un nivel distinto en cada uno): 4, 7, 8, 9, 9 y 10.
  const elos = [1000, 1400, 1600, 1800, 2000, 2500];
  await insert('player_elo', playerIds.map((_, i) => ({ steam_id: steam(i), elo: elos[i], peak_elo: elos[i], matches: 2 })));
  await insert('live_matches', [{
    uid: liveUid, server_id: serverId, server_name: `Mpr ${sfx}`, seq: 3, map: 'de_nuke', score_a: 2, score_b: 1, max_rounds: 24, started_at: new Date().toISOString(),
    payload: { team_names: { a: `Vivo${sfx}`, b: '' }, players: [{ steamid: steam(1), name: `vivo1${sfx}`, team: 'a', kills: 7, deaths: 1, rounds: 3 }] },
  }]);
  await insert('player_medals', [
    { player_id: playerIds[0], title: `MVP ${sfx}`, icon: '⭐' },
    { player_id: playerIds[0], title: `MVP ${sfx}`, icon: '⭐' },
    { player_id: playerIds[0], title: `Top ${sfx}`, icon: '🏆' },
  ]);
  // Torneo: la final la gana el equipo 0 (ficha 0 inscrita); la base marca el campeón sola.
  await insert('teams', teamIds.map((id, i) => ({ id, name: `MprT${i}${sfx}`, tag: `M${i}`, kind: 'official' })));
  await insert('team_members', [{ team_id: teamIds[0], player_id: playerIds[0] }, { team_id: teamIds[1], player_id: playerIds[3] }]);
  await insert('events', [{ id: eventId, name: `Copa ${sfx}`, template: 'single', game_mode: '1v1' }]);
  await insert('tournament_registrations', teamIds.map((team_id) => ({ event_id: eventId, team_id })));
  await insert('tournament_registration_players', [
    { event_id: eventId, team_id: teamIds[0], player_id: playerIds[0] },
    { event_id: eventId, team_id: teamIds[1], player_id: playerIds[3] },
  ]);
  // El fixture lo genera el motor (como admin); la final se termina a mano y el motor marca el campeón.
  expect((await call('POST', `/api/v1/events/${eventId}/generate`, undefined, adminToken)).status).toBeLessThan(300);
  const fin = await admin().from('matches').select('id, team1').eq('event_id', eventId).single();
  if (fin.error) throw fin.error;
  finalId = fin.data.id as string;
  const t0first = fin.data.team1 === teamIds[0];
  const done = await admin().from('matches')
    .update({ status: 'finished', score1: t0first ? 1 : 0, score2: t0first ? 0 : 1, winner: teamIds[0], played_at: day(1) })
    .eq('id', finalId);
  if (done.error) throw done.error;
});

afterAll(async () => {
  const a = admin();
  await a.from('live_matches').delete().eq('uid', liveUid);
  await a.from('matches').delete().in('id', mixIds);
  await a.from('matches').delete().eq('event_id', eventId);
  await a.from('tournament_registration_players').delete().eq('event_id', eventId);
  await a.from('tournament_registrations').delete().eq('event_id', eventId);
  await a.from('events').delete().eq('id', eventId);
  await a.from('team_members').delete().in('team_id', teamIds);
  await a.from('teams').delete().in('id', teamIds);
  await a.from('player_medals').delete().in('player_id', playerIds);
  await a.from('elo_adjustments').delete().in('steam_id', playerIds.map((_, i) => steam(i)));
  await a.from('mix_deletions').delete().in('match_id', mixIds);
  await a.from('player_elo').delete().in('steam_id', playerIds.map((_, i) => steam(i)));
  await a.from('players').delete().in('id', playerIds);
  await a.from('game_servers').delete().eq('id', serverId);
  if (!eloConfigBefore) await a.from('elo_config').delete().eq('id', 1);
});

describe('mixes', () => {
  it('listado único: en vivo primero, con TV, MVP y filtros', async () => {
    const { status, body } = await get(`/api/v1/mixes?q=${sfx}&server=${serverId}`);
    expect(status).toBe(200);
    expect(body.total).toBe(4);
    expect(body.items[0]).toMatchObject({
      match_id: null, live_uid: liveUid, status: 'live', map: 'de_nuke', current_round: 4, max_rounds: 24, rounds_played: 3,
      server: { id: serverId, name: `Mpr ${sfx}` }, tv: { host: '10.9.9.9', port: 27020 }, ended_at: null,
      mvp: { player_id: playerIds[1], alias: nick(1), game_nick: `vivo1${sfx}` },
    });
    expect(body.items.slice(1).map((m: { match_id: string }) => m.match_id)).toEqual([mixIds[2], mixIds[1], mixIds[0]]);
    const done = body.items.find((m: { match_id: string }) => m.match_id === mixIds[0]);
    expect(done).toMatchObject({ status: 'finished', winner_side: 1, tv: null, demo_status: 'uploaded', mvp: { player_id: playerIds[4], alias: nick(4), level: expect.any(Number) } });
    expect(body.items.find((m: { match_id: string }) => m.match_id === mixIds[2])).toMatchObject({ status: 'cancelled', cancel_reason: 'admin' });

    expect((await get(`/api/v1/mixes?server=${serverId}&hide_cancelled=true`)).body.total).toBe(3);
    expect((await get(`/api/v1/mixes?server=${serverId}&status=live`)).body.total).toBe(1);
    expect((await get(`/api/v1/mixes?server=${serverId}&map=inferno`)).body.items.map((m: { match_id: string }) => m.match_id)).toEqual([mixIds[1]]);
    expect((await get(`/api/v1/mixes?q=g5${sfx}`)).body.total).toBe(2); // por el nombre del juego
    expect((await get(`/api/v1/mixes?server=${serverId}&sort=rounds&order=asc`)).body.items[0].rounds_played).toBe(1);
    expect((await get('/api/v1/mixes?sort=score')).status).toBe(400);
  });

  it('solo donde jugué: pide sesión; sin ficha, vacío', async () => {
    expect((await get('/api/v1/mixes?mine=true')).status).toBe(401);
    const mine = await get(`/api/v1/mixes?mine=true&server=${serverId}`, owner.token);
    expect(mine.body.items.map((m: { match_id: string }) => m.match_id).sort()).toEqual([mixIds[0], mixIds[1]].sort());
    expect((await get('/api/v1/mixes?mine=true', userToken)).body).toMatchObject({ total: 0, items: [] });
  });

  it('números de la cabecera', async () => {
    const { status, body } = await get('/api/v1/mixes/stats');
    expect(status).toBe(200);
    expect(body).toMatchObject({ live_now: expect.any(Number), players_recent: expect.any(Number), window_days: 30 });
    expect(body.live_now).toBeGreaterThanOrEqual(1);
    expect(body.players_recent).toBeGreaterThanOrEqual(6);
  });

  it('el detalle en vivo trae la TV y el de la partida, el tamaño de la demo', async () => {
    expect((await get(`/api/v1/mixes/live/${liveUid}`)).body.tv).toEqual({ host: '10.9.9.9', port: 27020 });
    expect((await get(`/api/v1/mixes/live?server=${serverId}`)).body.items[0].tv).toEqual({ host: '10.9.9.9', port: 27020 });
    expect((await get(`/api/v1/matches/${mixIds[0]}`)).body.demo_size).toBe(52_428_800);
    expect((await get(`/api/v1/matches/${mixIds[1]}`)).body.demo_size).toBeNull();
  });
});

describe('servidores: puerto de SourceTV', () => {
  it('alta, edición y validación', async () => {
    const created = await call('POST', '/api/v1/admin/servers', { name: `MprS ${sfx}`, connect_address: '10.1.1.1:27015', tv_port: 27025 }, adminToken);
    expect(created.status).toBe(201);
    const id = (await created.json()).id as string;
    try {
      expect((await get(`/api/v1/admin/servers/${id}`, adminToken)).body.tv_port).toBe(27025);
      const patched = await call('PATCH', `/api/v1/admin/servers/${id}`, { tv_port: null }, adminToken);
      expect((await patched.json()).tv_port).toBeNull();
      expect((await call('PATCH', `/api/v1/admin/servers/${id}`, { tv_port: 70000 }, adminToken)).status).toBe(400);
    } finally {
      await admin().from('game_servers').delete().eq('id', id);
    }
  });
});

describe('perfil público', () => {
  it('por id o por nick; los SteamID solo para el dueño y los admins', async () => {
    const byNick = await get(`/api/v1/players/${nick(0).toUpperCase()}`);
    expect(byNick.status).toBe(200);
    expect(byNick.body).toMatchObject({ id: playerIds[0], alias: nick(0), has_steam: true, steam_id: null, steam_ids: [] });
    expect((await get(`/api/v1/players/${playerIds[0]}`, userToken)).body.steam_ids).toEqual([]);
    expect((await get(`/api/v1/players/${playerIds[0]}`, owner.token)).body).toMatchObject({ steam_id: steam(0), steam_ids: [steam(0)] });
    expect((await get(`/api/v1/players/${nick(0)}`, adminToken)).body.steam_ids).toEqual([steam(0)]);
    expect((await get(`/api/v1/players/nadie${sfx}`)).status).toBe(404);
    expect((await get(`/api/v1/players/${nick(1)}/matches`)).body.total).toBe(2);
    expect((await get(`/api/v1/players/nadie${sfx}/matches`)).status).toBe(404);
  });

  it('historial de ELO, palmarés, medallas agrupadas y partidas con torneo', async () => {
    const hist = await get(`/api/v1/players/${nick(0)}/elo-history`);
    expect(hist.status).toBe(200);
    expect(hist.body).toMatchObject({ total: 2, per: 30 });
    expect(hist.body.items.map((p: { match_id: string }) => p.match_id)).toEqual([mixIds[1], mixIds[0]]);
    expect(hist.body.items[0]).toMatchObject({ map: 'de_inferno', elo_delta: -20 });
    expect((await get(`/api/v1/players/${nick(0)}/elo-history?order=asc&per=1`)).body.items[0].match_id).toBe(mixIds[0]);

    const titles = await get(`/api/v1/players/${nick(0)}/titles`);
    expect(titles.body.items).toEqual([{ event: { id: eventId, name: `Copa ${sfx}` }, result: 'champion', team: { id: teamIds[0], name: `MprT0${sfx}`, tag: 'M0' }, at: expect.any(String) }]);
    expect((await get(`/api/v1/players/${nick(3)}/titles?result=runner_up`)).body.items[0]).toMatchObject({ result: 'runner_up', team: { id: teamIds[1] } });
    expect((await get(`/api/v1/players/${nick(3)}/titles?result=champion`)).body.total).toBe(0);

    const medals = await get(`/api/v1/players/${nick(0)}/medals/summary`);
    expect(medals.body.items).toEqual([
      { title: `MVP ${sfx}`, icon: '⭐', count: 2, last_at: expect.any(String) },
      { title: `Top ${sfx}`, icon: '🏆', count: 1, last_at: expect.any(String) },
    ]);
    expect((await get(`/api/v1/players/${nick(0)}/medals/summary?sort=title&order=desc&per=1`)).body).toMatchObject({ total: 2, items: [{ title: `Top ${sfx}` }] });
    expect((await get(`/api/v1/players/${nick(0)}/medals`)).body.total).toBe(3);

    const ms = await get(`/api/v1/players/${nick(0)}/matches?kind=mix`);
    expect(ms.body.items[0]).toMatchObject({ event: null, label: null });
  });
});

describe('ranking y comparador', () => {
  it('ranking de jugadores: posición global, nivel y tendencia', async () => {
    const all = await get(`/api/v1/ranking/players?q=${sfx}&per=100`);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(6);
    const top = all.body.items[0];
    expect(top).toMatchObject({ player: { id: playerIds[5], alias: nick(5) }, elo: 2500, level: 10, matches: 2, elo_trend: [1480, 1500] });
    expect(all.body.items.map((r: { position: number }) => r.position)).toEqual([...all.body.items.map((r: { position: number }) => r.position)].sort((a, b) => a - b));
    // La posición es global: filtrar no la cambia.
    const one = await get(`/api/v1/ranking/players?q=${nick(5)}`);
    expect(one.body.items[0].position).toBe(top.position);
    expect((await get(`/api/v1/ranking/players?q=${sfx}&level=10`)).body.items.map((r: { player: { id: string } }) => r.player.id)).toEqual([playerIds[5]]);
    expect((await get(`/api/v1/ranking/players?q=${sfx}&level=1-6`)).body.total).toBe(1);
    expect((await get('/api/v1/ranking/players?level=5')).status).toBe(400);
    // País según la privacidad: la ficha 0 tiene cuenta, el resto no.
    expect(all.body.items.find((r: { player: { id: string } }) => r.player.id === playerIds[3]).country).toBeNull();
  });

  it('ranking de equipos con % de victorias, tendencia y forma', async () => {
    const r = await get(`/api/v1/ranking/teams?q=MprT&per=100`);
    const t0 = r.body.items.find((i: { team: { id: string } }) => i.team.id === teamIds[0]);
    expect(t0).toMatchObject({ played: 1, won: 1, points: 30, win_rate: 100, form: ['W'], trend: null });
    expect(r.body.items.find((i: { team: { id: string } }) => i.team.id === teamIds[1])).toMatchObject({ win_rate: 0, form: ['L'] });
  });

  it('comparador: dos jugadores por id o nick, con mixes juntos y como rivales', async () => {
    const res = await get(`/api/v1/players/compare?a=${nick(0)}&b=${playerIds[1]}`);
    expect(res.status).toBe(200);
    expect(res.body.a).toMatchObject({ player: { id: playerIds[0], alias: nick(0) }, elo: 1000, level: 4, matches: 2, win_rate: 50, elo_history: [1520, 1500] });
    expect(res.body.together).toEqual({ same_team: { matches: 2, wins: 1 }, against: { matches: 0, a_wins: 0 } });
    const rivals = await get(`/api/v1/players/compare?a=${nick(0)}&b=${nick(3)}`);
    expect(rivals.body.together).toEqual({ same_team: { matches: 0, wins: 0 }, against: { matches: 2, a_wins: 1 } });
    expect((await get(`/api/v1/players/compare?a=${nick(0)}&b=${nick(0)}`)).status).toBe(400);
    expect((await get(`/api/v1/players/compare?a=${nick(0)}`)).status).toBe(400);
    expect((await get(`/api/v1/players/compare?a=${nick(0)}&b=nadie${sfx}`)).status).toBe(404);
  });
});

describe('borrar un mix', () => {
  it('permisos y confirmación', async () => {
    expect((await call('DELETE', `/api/v1/admin/mixes/${mixIds[2]}`, { elo: 'keep', confirm: 'estoy seguro' })).status).toBe(401);
    expect((await call('DELETE', `/api/v1/admin/mixes/${mixIds[2]}`, { elo: 'keep', confirm: 'estoy seguro' }, userToken)).status).toBe(403);
    expect((await call('DELETE', `/api/v1/admin/mixes/${mixIds[2]}`, { elo: 'keep', confirm: 'no' }, adminToken)).status).toBe(400);
    expect((await call('DELETE', `/api/v1/admin/mixes/${mixIds[2]}`, { elo: 'otro', confirm: 'estoy seguro' }, adminToken)).status).toBe(400);
    expect((await call('DELETE', `/api/v1/admin/mixes/${finalId}`, { elo: 'keep', confirm: 'estoy seguro' }, adminToken)).status).toBe(400);
  });

  it('mantener y revertir el ELO, sin recalcular', async () => {
    const elo = async (i: number) => (await admin().from('player_elo').select('elo').eq('steam_id', steam(i)).single()).data!.elo as number;
    const before = await elo(0);
    // Mantener (mix 0: la ficha 0 ganó +20): el ELO no cambia y el jugador no ve ningún ajuste.
    let res = await call('DELETE', `/api/v1/admin/mixes/${mixIds[0]}`, { elo: 'keep', confirm: 'estoy seguro' }, adminToken);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ elo_mode: 'keep', players: 6 });
    expect(await elo(0)).toBe(before);
    expect((await get(`/api/v1/players/${playerIds[0]}/elo-adjustments`)).body.total).toBe(0);
    expect((await get(`/api/v1/matches/${mixIds[0]}`)).status).toBe(404);
    // Revertir (mix 1: la ficha 0 perdió -20): le vuelven los 20.
    res = await call('DELETE', `/api/v1/admin/mixes/${mixIds[1]}`, { elo: 'revert', confirm: 'estoy seguro' }, adminToken);
    expect(await res.json()).toEqual({ elo_mode: 'revert', players: 6 });
    expect(await elo(0)).toBe(before + 20);
    // El cancelado no movió el ELO.
    res = await call('DELETE', `/api/v1/admin/mixes/${mixIds[2]}`, { elo: 'revert', confirm: 'estoy seguro' }, adminToken);
    expect(await res.json()).toEqual({ elo_mode: 'none', players: 0 });
    expect((await call('DELETE', `/api/v1/admin/mixes/${mixIds[2]}`, { elo: 'keep', confirm: 'estoy seguro' }, adminToken)).status).toBe(404);
  });
});
