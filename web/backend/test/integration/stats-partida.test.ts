import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, localEnv } from './local';

// Estadísticas de partida estilo HLTV (replanteo 29) contra la Supabase local: detalle del mix, foto en vivo y ficha.
const app = createApp();
const env = localEnv();
const sfx = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const serverId = crypto.randomUUID();
const oldServerId = crypto.randomUUID();
const playerIds = [crypto.randomUUID(), crypto.randomUUID()];
const mixId = crypto.randomUUID();
const oldMixId = crypto.randomUUID();
const liveUid = `sp${sfx}-vivo`;
const steam = (i: number) => `7656119${(Number.parseInt(sfx.slice(-5), 36) % 1_000_000).toString().padStart(6, '0')}${(i + 7000).toString().padStart(4, '0')}`;

const get = async (path: string) => {
  const res = await app.request(path, {}, env);
  return { status: res.status, body: await res.json() };
};
async function insert(table: string, rows: unknown) {
  const r = await admin().from(table).insert(rows as never);
  if (r.error) throw r.error;
}

beforeAll(async () => {
  const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  await insert('game_servers', [
    { id: serverId, name: `Sp ${sfx}`, token_hash: `h${sfx}` },
    { id: oldServerId, name: `SpViejo ${sfx}`, token_hash: `hv${sfx}` },
  ]);
  await insert('players', playerIds.map((id, i) => ({ id, nick: `Sp${i}${sfx}`, steam_id: steam(i) })));
  await insert('matches', [
    { id: mixId, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 13, score2: 9, winner_side: 1, played_at: day(1), server_id: serverId },
    // En un servidor que nunca mandó jugadas: sin datos de clutch.
    { id: oldMixId, kind: 'mix', status: 'finished', map: 'de_nuke', score1: 13, score2: 2, winner_side: 1, played_at: day(2), server_id: oldServerId },
  ]);
  await insert('match_player_stats', [
    { match_id: mixId, steam_id: steam(0), player_id: playerIds[0], team: 1, nick: 'a', kills: 24, deaths: 12, rounds: 22, k2: 5, k3: 2, k4: 1, k5: 0, first_kills: 6, first_deaths: 2, plants: 3, defuses: 0, rating: 1.4 },
    { match_id: mixId, steam_id: steam(1), player_id: playerIds[1], team: 2, nick: 'b', kills: 10, deaths: 20, rounds: 22, k2: 1, k3: 0, k4: 0, k5: 0, first_kills: 1, first_deaths: 5, plants: 0, defuses: 1, rating: 0.7 },
    { match_id: oldMixId, steam_id: steam(0), player_id: playerIds[0], team: 1, nick: 'a', kills: 20, deaths: 5, rounds: 15, k2: 2, k3: 1, k4: 0, k5: 1, first_kills: 3, first_deaths: 0, plants: 1, defuses: 1, rating: 1.9 },
  ]);
  // Dos clutches ganados de la ficha 0 (1v1 y 1v3) y uno perdido (no cuenta).
  await insert('match_clips', [
    { match_id: mixId, round: 4, player_steamid: steam(0), player_name: 'a', round_won: true, kill_ticks: [10], clutch_vs: 1, clutch_start_tick: 5, end_tick: 20 },
    { match_id: mixId, round: 9, player_steamid: steam(0), player_name: 'a', round_won: true, kill_ticks: [10, 20, 30], clutch_vs: 3, clutch_start_tick: 5, end_tick: 40 },
    { match_id: mixId, round: 15, player_steamid: steam(0), player_name: 'a', round_won: false, kill_ticks: [10, 20, 30], clutch_vs: 4, clutch_start_tick: 5, end_tick: 40 },
  ]);
  await insert('live_matches', [{
    uid: liveUid, server_id: serverId, server_name: `Sp ${sfx}`, seq: 1, map: 'de_inferno', score_a: 4, score_b: 2, max_rounds: 24, started_at: new Date().toISOString(),
    payload: { players: [{ steamid: steam(0), name: 'vivo', team: 'a', rounds: 6, kills: 8, deaths: 2, k2: 2, k3: 1, first_kills: 3, first_deaths: 1, plants: 1 }] },
  }]);
});

afterAll(async () => {
  const a = admin();
  await a.from('live_matches').delete().eq('uid', liveUid);
  await a.from('matches').delete().in('id', [mixId, oldMixId]);
  await a.from('players').delete().in('id', playerIds);
  await a.from('game_servers').delete().in('id', [serverId, oldServerId]);
});

describe('estadísticas de partida (replanteo 29)', () => {
  it('detalle del mix: multi-kills, entry, objetivos y clutches ganados', async () => {
    const { status, body } = await get(`/api/v1/matches/${mixId}`);
    expect(status).toBe(200);
    expect(body.clutch_data).toBe(true);
    const p0 = body.players.find((p: { player_id: string }) => p.player_id === playerIds[0]);
    expect(p0).toMatchObject({ k2: 5, k3: 2, k4: 1, k5: 0, first_kills: 6, first_deaths: 2, plants: 3, defuses: 0 });
    expect(p0.clutches).toEqual({ '1': 1, '2': 0, '3': 1, '4': 0, '5': 0 });
    const p1 = body.players.find((p: { player_id: string }) => p.player_id === playerIds[1]);
    expect(p1.clutches).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
  });

  it('un mix sin datos de clutch: clutch_data false y clutches null', async () => {
    const { body } = await get(`/api/v1/matches/${oldMixId}`);
    expect(body.clutch_data).toBe(false);
    expect(body.players[0].clutches).toBeNull();
    expect(body.players[0]).toMatchObject({ k5: 1, first_kills: 3 });
  });

  it('foto en vivo: las columnas nuevas (0 si el plugin no las mandó)', async () => {
    const { status, body } = await get(`/api/v1/mixes/live/${liveUid}`);
    expect(status).toBe(200);
    expect(body.players[0]).toMatchObject({ k2: 2, k3: 1, k4: 0, k5: 0, first_kills: 3, first_deaths: 1, plants: 1, defuses: 0 });
    expect(body.players[0].clutches).toBeUndefined();
  });

  it('ficha: los totales y los clutches de todos sus mixes', async () => {
    const { body } = await get(`/api/v1/players/${playerIds[0]}`);
    expect(body.stats).toMatchObject({ k2: 7, k3: 3, k4: 1, k5: 1, first_kills: 9, first_deaths: 2, plants: 4, defuses: 1 });
    expect(body.stats.clutches).toEqual({ '1': 1, '2': 0, '3': 1, '4': 0, '5': 0 });
  });
});
