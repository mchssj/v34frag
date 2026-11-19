import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SeasonRecap, SeasonSummary } from '../../src/schemas/seasons';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Recap y resumen de la temporada (replanteo 128, bitácora 2026-11-19-estadisticas-de-temporada) con PostgREST simulado.
// Cerrada: la foto, para todos. Activa: solo admins (la base vuelve a validar en season_*_live).
const USER = '77777777-7777-4777-8777-777777777777';
const SEASON = '88888888-8888-4888-8888-888888888888';
const PLAYER = '99999999-9999-4999-8999-999999999999';
const MATE = '66666666-6666-4666-8666-666666666666';
const MATCH = '55555555-5555-4555-8555-555555555555';
const TIERS = [{ from: 1, to: 1, name: 'Campeón', icon: '🏆' }, { from: 2, to: null, name: 'Top {top}', icon: '🏅' }];

const stat = (avg: number, pct: number) => ({ avg, pct });
const COMPARE = Object.fromEntries(
  ['matches', 'rounds', 'hours', 'win_pct', 'best_streak', 'kills', 'deaths', 'assists', 'kd', 'hs_pct', 'adr', 'k3', 'first_kills', 'k4', 'aces', 'elo_delta', 'rating']
    .map((k, i) => [k, stat(10 + i, 50 + i)]),
);
const head = { id: SEASON, number: 1, name: 'Temporada 1', starts_at: '2026-10-13T00:00:00+00:00', ends_at: '2026-11-09T09:00:00+00:00' };
const RECAP = {
  season: { ...head, closed_at: '2026-11-09T09:00:05+00:00', until: '2026-11-09T09:00:05+00:00', players: 3 },
  player: { id: PLAYER, elo: 1348, kd: 1.45, matches: 4 },
  mixes: { matches: 4, rounds: 90, hours: 2.5, busiest_day: { date: '2026-11-05', matches: 2 } },
  record: { wins: 3, losses: 1, win_pct: 75, best_streak: 2 },
  elo: { start: 1000, end: 1048, peak: 1060, delta: 48, points: [{ match_id: MATCH, map: 'cbble', at: '2026-11-05T19:00:00+00:00', elo_before: 1000, elo_after: 1020, elo_delta: 20 }] },
  numbers: { kills: 80, deaths: 55, assists: 10, kd: 1.45, hs_pct: 51, adr: 96.3, k3: 3, k4: 1, aces: 0, first_kills: 9, plants: 4, defuses: 1, rating: 1.33 },
  weapon: null,
  maps: [{ name: 'cbble', matches: 4, wins: 3, kd: 1.45 }],
  best_match: { id: MATCH, map: 'cbble', date: '2026-11-05T19:00:00+00:00', score: [16, 2], won: true, kills: 24, deaths: 4, adr: 140.9, rating: 2.17 },
  mates: {
    most_played: { id: MATE, elo: 1073, kd: 1.17, matches: 4, together: 3, won: 2 },
    most_wins: { id: MATE, elo: 1073, kd: 1.17, matches: 4, together: 3, won: 2 },
  },
  rivals: null,
  clips: [],
  compare: COMPARE,
  prev: null,
  final: { rank: 1, eligible: true, total_ranked: 2, elo: 1413, tier: 'Campeón', top_n: 20, min_matches: 3 },
};
const SUMMARY = {
  season: { ...head, status: 'closed', closed_at: '2026-11-09T09:00:05+00:00', until: '2026-11-09T09:00:05+00:00', min_matches: 3, top_n: 20 },
  games: { mixes: 4, players: 3, rounds: 90, hours: 2.5, avg_minutes: 34, kills: 300, hs_pct: 50, aces: 1, k4: 2, plants: 9, defuses: 2 },
  when: {
    busiest_day: { date: '2026-11-05', matches: 2 },
    by_hour: Array.from({ length: 24 }, (_, hour) => ({ hour, matches: hour === 22 ? 4 : 0 })),
    by_weekday: Array.from({ length: 7 }, (_, d) => ({ day: d + 1, matches: d === 3 ? 4 : 0 })),
  },
  maps: [{ name: 'cbble', matches: 4, avg_rounds: 22.5 }],
  servers: [{ name: 'CM League #1', matches: 4 }],
  longest: { match_id: MATCH, map: 'cbble', date: '2026-11-05T19:00:00+00:00', score1: 16, score2: 14 },
  matchmaking: {
    queue_joins: 50, queue_players: 12, matched: 40, left: 10, wait_median_s: 95, lobbies: 6, played: 4, cancelled: 2,
    cancel_reasons: [{ reason: 'Un jugador no aceptó a tiempo', count: 2 }], party_pct: 20, abandons: 1, replacements: 0,
    reports: 1, penalties: 2, bans: 0,
  },
  community: { new_accounts: 5, profile_visits: 30, comments: 2, friendships: 3, clips: 6, clips_video: 5, demos: 4, pcw: 0, official: 0, tournaments: 0 },
};

let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type World = { status: 'active' | 'closed'; role: string; stored: boolean };
const calls: URL[] = [];
function postgrest(w: World) {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const raw = String(input instanceof Request ? input.url : input);
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      calls.push(url);
      const path = url.pathname;
      if (path.endsWith('/profiles')) return Response.json({ role: w.role });
      if (path.endsWith('/players') && url.searchParams.get('select') === 'id') return Response.json({ id: PLAYER });
      if (path.endsWith('/players'))
        return Response.json([
          { id: PLAYER, nick: 'Alfa', photo_url: null },
          { id: MATE, nick: 'Beta', photo_url: 'https://x/y.webp' },
        ]);
      if (path.endsWith('/seasons')) return Response.json({ id: SEASON, number: 1, status: w.status, tiers: TIERS, top_n: 20 });
      if (path.endsWith('/season_recaps')) return Response.json(w.stored ? { data: RECAP } : null);
      if (path.endsWith('/season_summaries')) return Response.json(w.stored ? { data: SUMMARY } : null);
      if (path.endsWith('/rpc/season_recap_live')) return Response.json({ ...RECAP, season: { ...RECAP.season, closed_at: null } });
      if (path.endsWith('/rpc/season_summary_live')) return Response.json({ ...SUMMARY, season: { ...SUMMARY.season, status: 'active', closed_at: null } });
      return Response.json([]);
    }),
  );
}
const get = async (path: string, auth = true) =>
  makeApp().request(path, { headers: auth ? { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } : {} }, testEnv());
const hit = (name: string) => calls.some((u) => u.pathname.endsWith(name));

describe('recap de la temporada', () => {
  it('cerrada: la foto, sin sesión, con nick, nivel y medalla', async () => {
    postgrest({ status: 'closed', role: 'player', stored: true });
    const res = await get(`/api/v1/players/Alfa/seasons/1/recap`, false);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(() => SeasonRecap.parse(body)).not.toThrow();
    expect(body).toMatchObject({
      live: false,
      player: { id: PLAYER, alias: 'Alfa', elo: 1413, level: 7 },
      mates: { most_played: { alias: 'Beta', together: 3, photo_url: 'https://x/y.webp' } },
      final: { rank: 1, level: 7, medal: { name: 'Campeón' } },
      clips: [],
    });
    expect(hit('/rpc/season_recap_live')).toBe(false);
  });

  it('cerrada sin recap (no jugó): 404', async () => {
    postgrest({ status: 'closed', role: 'player', stored: false });
    expect((await get(`/api/v1/players/${PLAYER}/seasons/1/recap`)).status).toBe(404);
  });

  it('activa: un jugador recibe 404 y no se calcula nada', async () => {
    postgrest({ status: 'active', role: 'player', stored: false });
    const res = await get(`/api/v1/players/${PLAYER}/seasons/1/recap`);
    expect(res.status).toBe(404);
    expect((await json(res)).error.message).toMatch(/se publican cuando termina/);
    expect(hit('/rpc/season_recap_live')).toBe(false);
    postgrest({ status: 'active', role: 'player', stored: false });
    expect((await get(`/api/v1/players/${PLAYER}/seasons/1/recap`, false)).status).toBe(404);
  });

  it('activa: un admin la ve al momento', async () => {
    postgrest({ status: 'active', role: 'admin', stored: false });
    const res = await get(`/api/v1/players/${PLAYER}/seasons/1/recap`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ live: true, season: { closed_at: null } });
    expect(() => SeasonRecap.parse(body)).not.toThrow();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const rpc = calls.find((u) => u.pathname.endsWith('/rpc/season_recap_live'));
    expect(rpc).toBeDefined();
  });

  it('número de temporada inválido: 400', async () => {
    postgrest({ status: 'closed', role: 'player', stored: true });
    expect((await get(`/api/v1/players/${PLAYER}/seasons/0/recap`)).status).toBe(400);
  });
});

describe('resumen de la temporada', () => {
  it('cerrada: para todos, la web y el matchmaking sin rankings de jugadores', async () => {
    postgrest({ status: 'closed', role: 'player', stored: true });
    const res = await get('/api/v1/seasons/1/summary', false);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(() => SeasonSummary.parse(body)).not.toThrow();
    expect(body.live).toBe(false);
    expect(body.matchmaking).toMatchObject({ wait_median_s: 95, cancel_reasons: [{ reason: 'Un jugador no aceptó a tiempo', count: 2 }] });
    expect(body.when.by_hour).toHaveLength(24);
    expect(body).not.toHaveProperty('leaders');
    expect(body).not.toHaveProperty('podium');
    // Sin datos de personas: no hace falta buscar nicks.
    expect(hit('/players')).toBe(false);
  });

  it('activa: 404 para un jugador; al momento para un admin', async () => {
    postgrest({ status: 'active', role: 'player', stored: false });
    expect((await get('/api/v1/seasons/1/summary')).status).toBe(404);
    expect(hit('/rpc/season_summary_live')).toBe(false);
    postgrest({ status: 'active', role: 'admin', stored: false });
    const res = await get('/api/v1/seasons/1/summary');
    expect(res.status).toBe(200);
    expect((await json(res)).live).toBe(true);
  });
});
