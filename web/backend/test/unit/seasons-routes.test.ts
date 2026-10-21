import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Rutas de temporadas con PostgREST simulado (sin Docker): validación de los tramos y valores por defecto.
const USER = '77777777-7777-4777-8777-777777777777';
const SEASON = '88888888-8888-4888-8888-888888888888';
const PLAYER = '99999999-9999-4999-8999-999999999999';
const TIERS = [{ from: 1, to: 1, name: 'Campeón', icon: '🏆' }, { from: 2, to: null, name: 'Top {top}', icon: '🏅' }];
const ROW = {
  id: SEASON, number: 1, name: 'Temporada 1', status: 'active', starts_at: '2026-10-21T12:00:00+00:00', ends_at: '2026-11-20T09:00:00+00:00',
  closed_at: null, top_n: 20, min_matches: 20, reset_pct: 10, reset_floor: 2001, tiers: TIERS, champion_id: null, champion_nick: null, medals: 0,
};
const CONFIG = { duration_days: 30, top_n: 20, min_matches: 20, reset_pct: 10, reset_floor: 2001, tiers: TIERS };

let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const calls: { url: URL; body: unknown }[] = [];
function postgrest(handler: (url: URL) => Response | undefined) {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = String(input instanceof Request ? input.url : input);
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles')) return Response.json([{ role: 'admin' }]);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return handler(url) ?? Response.json([]);
    }),
  );
}
const call = async (method: string, path: string, body?: unknown) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );

describe('temporadas: validación', () => {
  it('los tramos van en orden, sin huecos y el último sin "hasta"', async () => {
    postgrest(() => undefined);
    const bad = [
      [{ from: 2, to: null, name: 'x', icon: 'x' }],
      [{ from: 1, to: 1, name: 'x', icon: 'x' }, { from: 3, to: null, name: 'y', icon: 'y' }],
      [{ from: 1, to: 3, name: 'x', icon: 'x' }],
      [{ from: 1, to: null, name: 'x', icon: 'x' }, { from: 2, to: null, name: 'y', icon: 'y' }],
      [],
    ];
    for (const tiers of bad) expect((await call('PUT', '/api/v1/admin/seasons/config', { ...CONFIG, tiers })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('rangos de la configuración y de la vista previa', async () => {
    postgrest(() => undefined);
    expect((await call('PUT', '/api/v1/admin/seasons/config', { ...CONFIG, duration_days: 0 })).status).toBe(400);
    expect((await call('PUT', '/api/v1/admin/seasons/config', { ...CONFIG, reset_pct: 101 })).status).toBe(400);
    expect((await call('GET', '/api/v1/admin/seasons/preview?top_n=20&min_matches=0&reset_pct=10&reset_floor=2001')).status).toBe(400);
    expect((await call('GET', '/api/v1/admin/seasons/preview?top_n=20')).status).toBe(400);
  });

  it('terminar pide "estoy seguro"', async () => {
    postgrest(() => undefined);
    expect((await call('POST', `/api/v1/admin/seasons/${SEASON}/close`, { confirm: 'si' })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('temporadas: respuestas', () => {
  it('sin temporada activa, 404', async () => {
    postgrest(() => undefined);
    expect((await call('GET', '/api/v1/seasons/current')).status).toBe(404);
  });

  it('la activa, sin campeón', async () => {
    postgrest((url) => (url.pathname.endsWith('/season_list') ? Response.json(ROW) : undefined));
    const body = await json(await call('GET', '/api/v1/seasons/current'));
    expect(body).toMatchObject({ id: SEASON, status: 'active', champion: null, tiers: TIERS, ends_at: ROW.ends_at });
  });

  it('ranking de una temporada que no existe: 404', async () => {
    postgrest(() => undefined);
    expect((await call('GET', `/api/v1/seasons/${SEASON}/standings`)).status).toBe(404);
  });

  it('ranking: nivel, medalla y valores vacíos', async () => {
    postgrest((url) => {
      if (url.pathname.endsWith('/season_list')) return Response.json(ROW);
      if (url.pathname.endsWith('/season_standings_list'))
        return Response.json([
          { player_id: PLAYER, nick: 'Alfa', photo_url: null, rank: 1, eligible: true, elo: 2540, peak_elo: 2600, matches: 25, wins: 15, losses: 10, elo_after: 2055, tier: 'Campeón', icon: '🏆' },
          { player_id: USER, nick: null, photo_url: null, rank: null, eligible: false, elo: 900, peak_elo: null, matches: null, wins: null, losses: null, elo_after: null, tier: null, icon: null },
        ]);
      return undefined;
    });
    const body = await json(await call('GET', `/api/v1/seasons/${SEASON}/standings?q=Álfa&eligible=true`));
    expect(body.items[0]).toEqual({
      rank: 1, player: { id: PLAYER, alias: 'Alfa', photo_url: null }, eligible: true, elo: 2540, level: 10, peak_elo: 2600,
      matches: 25, wins: 15, losses: 10, elo_after: 2055, medal: { name: 'Campeón', icon: '🏆' },
    });
    expect(body.items[1]).toMatchObject({ rank: null, player: { alias: '' }, level: 3, peak_elo: 900, matches: 0, elo_after: 900, medal: null });
    const q = calls.find((x) => x.url.pathname.endsWith('/season_standings_list'))!.url.searchParams;
    expect(q.get('search')).toBe('ilike.%alfa%');
    expect(q.get('eligible')).toBe('eq.true');
    expect(q.get('order')).toBe('rank.asc.nullslast,elo.asc.nullslast,player_id.asc');
  });

  it('vista previa: filas, filtros y resumen', async () => {
    postgrest((url) => {
      if (url.pathname.endsWith('/rpc/season_preview'))
        return Response.json([{ player_id: PLAYER, nick: 'Alfa', rank: 1, eligible: true, elo: 2540, matches: 25, tier: 'Campeón', icon: '🏆', elo_after: 2001, reset: true }]);
      if (url.pathname.endsWith('/rpc/season_preview_summary'))
        return Response.json({ players: 10, eligible: 4, medals: 4, reset: 1, avg_drop: 539, max_drop: 539 });
      return undefined;
    });
    const res = await call('GET', '/api/v1/admin/seasons/preview?top_n=20&min_matches=5&reset_pct=0&reset_floor=2001&medal=true');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items).toEqual([
      { rank: 1, player: { id: PLAYER, alias: 'Alfa' }, eligible: true, elo: 2540, matches: 25, medal: { name: 'Campeón', icon: '🏆' }, elo_after: 2001, reset: true },
    ]);
    expect(body.summary).toEqual({ players: 10, eligible: 4, medals: 4, reset: 1, avg_drop: 539, max_drop: 539 });
    const rpc = calls.find((x) => x.url.pathname.endsWith('/rpc/season_preview'))!;
    expect(rpc.body).toEqual({ p_top_n: 20, p_min_matches: 5, p_reset_pct: 0, p_reset_floor: 2001 });
    expect(rpc.url.searchParams.get('tier')).toBe('not.is.null');
  });

  it('medallas de un jugador: las manuales sin temporada', async () => {
    postgrest((url) =>
      url.pathname.endsWith('/player_medals')
        ? Response.json([
            { id: SEASON, title: 'MVP', icon: '⭐', created_at: '2026-10-01T00:00:00+00:00', rank: null, season: null },
            { id: USER, title: 'Temporada 1 · #1', icon: '🏆', created_at: '2026-11-20T09:00:00+00:00', rank: 1, season: { id: SEASON, number: 1, name: 'Temporada 1' } },
          ])
        : undefined,
    );
    const body = await json(await call('GET', `/api/v1/players/${PLAYER}/medals`));
    expect(body.items.map((m: { season: unknown; rank: unknown }) => [m.season, m.rank])).toEqual([
      [null, null],
      [{ id: SEASON, number: 1, name: 'Temporada 1' }, 1],
    ]);
  });
});
