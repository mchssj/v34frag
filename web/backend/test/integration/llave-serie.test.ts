import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// E21 (stats de la serie) y E22 (a qué partida pasa cada lado) contra la Supabase local.
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

/** Equipo oficial con capitán y 5 jugadores con SteamID. */
async function team() {
  const cap = await createUser({ tag: `Cap${rnd()}` });
  const sb = admin();
  const t = (await sb.from('teams').insert({ name: `T ${rnd()}`, tag: 'T', kind: 'official', captain_id: cap.id, owner_id: cap.id }).select('id').single()).data!;
  const capPlayer = (await sb.from('players').insert({ nick: `C${rnd()}`, user_id: cap.id, steam_id: steam() }).select('id, steam_id').single()).data!;
  const others = (await sb.from('players').insert(Array.from({ length: 4 }, (_, i) => ({ nick: `J${i}${rnd()}`, steam_id: steam() }))).select('id, steam_id')).data!;
  const players = [capPlayer, ...others] as { id: string; steam_id: string }[];
  const r = await sb.from('team_members').insert(players.map((p) => ({ team_id: t.id, player_id: p.id, joined_at: new Date().toISOString() })));
  if (r.error) throw r.error;
  return { id: t.id as string, cap, players };
}

type EventMatch = { id: string; stage: string; round: number; pos: number; next_win: string | null; next_win_slot: number | null; next_lose: string | null; next_lose_slot: number | null };

let org: U;
let ev: string;
let matches: EventMatch[];
let teams: Awaited<ReturnType<typeof team>>[];
beforeAll(async () => {
  const adm = await createUser({ role: 'admin' });
  org = await createUser({ tag: `Org${rnd()}` });
  expect((await req('PUT', `/api/v1/admin/users/${org.id}/role`, { token: adm.token, body: { role: 'organizer' } })).status).toBe(204);
  ev = (await req('POST', '/api/v1/events', { token: org.token, body: { name: `Doble ${rnd()}`, template: 'double' } })).body.id;
  teams = await Promise.all([team(), team(), team(), team()]);
  for (const t of teams) {
    expect((await req('PUT', `/api/v1/events/${ev}/registrations/${t.id}`, { token: t.cap.token, body: { active: t.players.map((p) => p.id) } })).status).toBe(204);
  }
  expect((await req('POST', `/api/v1/events/${ev}/generate`, { token: org.token })).status).toBe(204);
  matches = (await req('GET', `/api/v1/events/${ev}/matches?per=200`)).body.items;
});

describe('E22: enlaces de la llave', () => {
  it('cada partida dice a cuál pasan el ganador y el perdedor', () => {
    const byId = new Map(matches.map((m) => [m.id, m]));
    const upper1 = matches.filter((m) => m.stage === 'upper' && m.round === 1);
    expect(upper1).toHaveLength(2);
    for (const m of upper1) {
      expect(byId.get(m.next_win!)).toMatchObject({ stage: 'upper', round: 2 });
      expect(byId.get(m.next_lose!)).toMatchObject({ stage: 'lower' });
      expect([1, 2]).toContain(m.next_win_slot);
      expect([1, 2]).toContain(m.next_lose_slot);
    }
    // Los dos perdedores del upper 1 van a lados distintos o a partidas distintas del lower.
    const [a, b] = upper1;
    expect(`${a!.next_lose}:${a!.next_lose_slot}`).not.toBe(`${b!.next_lose}:${b!.next_lose_slot}`);
    const grand = matches.find((m) => m.stage === 'grand')!;
    expect(grand).toMatchObject({ next_win: null, next_lose: null });
  });

  it('el filtro stage acepta group_upper y group_lower', async () => {
    expect((await req('GET', `/api/v1/events/${ev}/matches?stage=group_upper`)).body).toMatchObject({ total: 0 });
    expect((await req('GET', `/api/v1/events/${ev}/matches?stage=group_lower`)).status).toBe(200);
  });
});

describe('E21: stats de la serie', () => {
  it('suma los juegos terminados en los lados de la serie, con el rating ponderado por rondas', async () => {
    const sb = admin();
    const m = matches.find((x) => x.stage === 'upper' && x.round === 1)!;
    const row = (await sb.from('matches').select('team1, team2').eq('id', m.id).single()).data!;
    const t1 = teams.find((t) => t.id === row.team1)!;
    const t2 = teams.find((t) => t.id === row.team2)!;
    expect((await req('GET', `/api/v1/matches/${m.id}`)).body.series_players).toEqual([]);

    const game = async (status: string, parent_side1: number) =>
      (await sb.from('matches').insert({ kind: 'mix', status, side1_name: 'A', side2_name: 'B', parent_match_id: m.id, parent_side1, played_at: new Date().toISOString() }).select('id').single()).data!.id as string;
    // Juego 1 con los bandos de la serie; juego 2 invertido (el bando 2 del juego es el lado 1 de la serie); el en vivo no cuenta.
    const g1 = await game('finished', 1);
    const g2 = await game('finished', 2);
    const g3 = await game('live', 1);
    const p1 = t1.players[0]!;
    const p2 = t2.players[0]!;
    const ins = await sb.from('match_player_stats').insert([
      { match_id: g1, steam_id: p1.steam_id, player_id: p1.id, team: 1, nick: 'uno', kills: 25, deaths: 10, rounds: 30, rating: 1.5 },
      { match_id: g1, steam_id: p2.steam_id, player_id: p2.id, team: 2, nick: 'dos', kills: 10, deaths: 25, rounds: 30, rating: 0.7 },
      { match_id: g2, steam_id: p1.steam_id, player_id: p1.id, team: 2, nick: 'uno', kills: 10, deaths: 12, rounds: 20, rating: 0.5 },
      { match_id: g2, steam_id: p2.steam_id, player_id: p2.id, team: 1, nick: 'dos', kills: 12, deaths: 10, rounds: 20, rating: 1.2 },
      { match_id: g3, steam_id: p1.steam_id, player_id: p1.id, team: 1, nick: 'uno', kills: 99, deaths: 0, rounds: 5, rating: 3 },
    ]);
    if (ins.error) throw ins.error;

    const d = await req('GET', `/api/v1/matches/${m.id}`);
    expect(d.status).toBe(200);
    expect(d.body.series_players).toHaveLength(2);
    expect(d.body.series_players[0]).toMatchObject({ player_id: p1.id, side: 1, kills: 35, deaths: 22, rounds: 50, rating: 1.1, elo_delta: null, clutches: null });
    expect(d.body.series_players[1]).toMatchObject({ player_id: p2.id, side: 2, kills: 22, rounds: 50, rating: 0.9 });
    expect(d.body.players).toEqual([]);
  });
});
