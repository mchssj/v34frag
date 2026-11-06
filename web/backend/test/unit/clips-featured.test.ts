import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Clips destacados en el perfil y rechazar un clip (replanteo 76), con PostgREST simulado.
const USER = '76767676-7676-4767-8767-767676767676';
const PLAYER = '99999999-9999-4999-8999-999999999999';
const MATCH = '88888888-8888-4888-8888-888888888888';
const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';
const row = (id: string, position: number) => ({
  id, match_id: MATCH, position, type: 'ace', priority: 1, round: 14, round_seconds: 42, round_won: true,
  player_steamid: '76561199900000001', player_id: PLAYER, player_name: 'kyan', kills: 5, kill_ticks: [1, 2, 3, 4, 5],
  clutch_vs: null, clutch_start_tick: null, end_tick: null, tickrate: 66, demo_status: 'uploaded',
  video_status: 'done', video_key: 'clips/a.mp4', video_seconds: 21, video_drive_id: 'd1', video_in_r2: true, vip: false, review: null,
});
const FEATURED = { player_id: PLAYER, mode: 'manual', vip: false, max: 3, max_vip: 10, picked: [C2, C1], shown: [C2, C1] };
const CONFIG = {
  priorities: { ace: 1, clutch_5: 2, clutch_4: 2, '4k': 3, clutch_3: 4, '3k': 5, clutch_2: 6, clutch_1: 7 },
  per_player: 2, per_match: 10, split_gap_seconds: 8, pre_seconds: 3, post_seconds: 2, vip_per_match: 3, featured_max: 3, featured_max_vip: 10,
  updated_at: '2026-11-05T00:00:00Z', updated_by: null,
};

let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const calls: { url: URL; body: unknown }[] = [];
function postgrest(handler: (url: URL, body: unknown) => Response | undefined, role: 'admin' | 'user' = 'admin') {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = String(input instanceof Request ? input.url : input);
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (url.pathname.endsWith('/profiles')) return Response.json([{ role, tag: 'Daniel', id: USER }]);
      calls.push({ url, body });
      return handler(url, body) ?? Response.json([]);
    }),
  );
}
const call = async (method: string, path: string, body?: unknown, auth = true) =>
  makeApp().request(
    path,
    {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    testEnv(),
  );
const rpcs = () => calls.filter((c) => c.url.pathname.includes('/rpc/')).map((c) => ({ fn: c.url.pathname.split('/rpc/')[1], body: c.body }));
// Las filas de la lista, en desorden: la API las devuelve en el orden de los ids.
const clipsAndMatch = (url: URL) => {
  if (url.pathname.endsWith('/match_clip_list')) {
    if (url.searchParams.get('select') === 'id') return Response.json([{ id: C1 }, { id: C2 }]);
    return Response.json([row(C1, 1), row(C2, 2)]);
  }
  if (url.pathname.endsWith('/matches')) return Response.json([{ id: MATCH, map: 'de_dust2', played_at: '2026-11-02T20:00:00Z' }]);
  if (url.pathname.endsWith('/players')) return Response.json([{ id: PLAYER, nick: 'kyan' }]);
  return undefined;
};

describe('Mi Perfil › Clips', () => {
  it('GET devuelve el modo, el tope, los elegidos y mis clips con su partida', async () => {
    postgrest((url) => (url.pathname.endsWith('/rpc/clip_my_featured') ? Response.json(FEATURED) : clipsAndMatch(url)));
    const res = await call('GET', '/api/v1/me/clips');
    expect(res.status).toBe(200);
    const b = (await res.json()) as { mode: string; max: number; shown: string[]; clips: { clip: { id: string }; match: { map: string } }[] };
    expect(b).toMatchObject({ mode: 'manual', max: 3, max_vip: 10, picked: [C2, C1], shown: [C2, C1] });
    expect(b).not.toHaveProperty('player_id');
    expect(b.clips.map((x) => x.clip.id)).toEqual([C1, C2]);
    expect(b.clips[0]!.match.map).toBe('de_dust2');
    // Solo los míos con video y sin revisión pendiente, del más nuevo al más viejo.
    const lista = calls.find((c) => c.url.pathname.endsWith('/match_clip_list') && c.url.searchParams.get('select') === 'id')!.url;
    expect(lista.searchParams.get('player_id')).toBe(`eq.${PLAYER}`);
    expect(lista.searchParams.get('video_status')).toBe('eq.done');
    expect(lista.searchParams.get('order')).toBe('created_at.desc');
  });

  it('PUT guarda el modo y los elegidos en orden', async () => {
    postgrest((url) => (url.pathname.endsWith('/rpc/clip_featured_set') ? Response.json(FEATURED) : clipsAndMatch(url)));
    const res = await call('PUT', '/api/v1/me/clips/featured', { mode: 'manual', ids: [C2, C1] });
    expect(res.status).toBe(200);
    expect(rpcs()).toContainEqual({ fn: 'clip_featured_set', body: { p_mode: 'manual', p_clips: [C2, C1] } });
  });

  it('PUT: más que el tope es 409 con el tope; un modo inválido no llega a la base', async () => {
    postgrest((url) =>
      url.pathname.endsWith('/rpc/clip_featured_set')
        ? Response.json({ code: 'V3901', message: 'Puedes destacar hasta 3 clips', details: '{"max": 3}' }, { status: 400 })
        : undefined,
    );
    const res = await call('PUT', '/api/v1/me/clips/featured', { mode: 'manual', ids: [C1, C2] });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { message: 'Puedes destacar hasta 3 clips', details: { max: 3 } } });
    expect((await call('PUT', '/api/v1/me/clips/featured', { mode: 'todos', ids: [] })).status).toBe(400);
  });

  it('sin sesión, 401', async () => {
    postgrest(() => undefined);
    expect((await call('GET', '/api/v1/me/clips', undefined, false)).status).toBe(401);
  });
});

describe('ficha pública: destacados', () => {
  it('en el orden de la base, sin sesión', async () => {
    postgrest((url) => {
      if (url.pathname.endsWith('/rpc/player_featured_clips_list')) return Response.json([C2, C1]);
      if (url.pathname.endsWith('/players') && url.searchParams.get('select') === 'id') return Response.json({ id: PLAYER });
      return clipsAndMatch(url);
    });
    const res = await call('GET', `/api/v1/players/${PLAYER}/clips/featured`, undefined, false);
    expect(res.status).toBe(200);
    const b = (await res.json()) as { items: { clip: { id: string; video: { url: string | null } } }[] };
    expect(b.items.map((x) => x.clip.id)).toEqual([C2, C1]);
  });

  it('un jugador que no existe es 404', async () => {
    postgrest((url) => (url.pathname.endsWith('/players') ? Response.json(null) : undefined));
    expect((await call('GET', `/api/v1/players/${PLAYER}/clips/featured`, undefined, false)).status).toBe(404);
  });
});

describe('Administración: rechazar y recuperar', () => {
  it('rechazar uno, con el motivo recortado', async () => {
    postgrest((url) => (url.pathname.endsWith('/match_clips') ? Response.json({ id: C1 }) : url.pathname.includes('/rpc/') ? Response.json('rejected') : undefined));
    const res = await call('POST', `/api/v1/admin/clips/${C1}/reject`, { reason: '  la cámara no lo sigue  ' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ id: C1, ok: true, error: null }] });
    expect(rpcs()).toContainEqual({ fn: 'clip_reject', body: { p_clip: C1, p_reason: 'la cámara no lo sigue' } });
  });

  it('rechazar sin motivo', async () => {
    postgrest((url) => (url.pathname.endsWith('/match_clips') ? Response.json({ id: C1 }) : url.pathname.includes('/rpc/') ? Response.json('rejected') : undefined));
    expect((await call('POST', `/api/v1/admin/clips/${C1}/reject`, {})).status).toBe(200);
    expect(rpcs()).toContainEqual({ fn: 'clip_reject', body: { p_clip: C1, p_reason: null } });
  });

  it('rechazar y recuperar varios: uno que falla no frena al resto', async () => {
    postgrest((url, body) => {
      if (!url.pathname.includes('/rpc/')) return undefined;
      return (body as { p_clip: string }).p_clip === C2
        ? Response.json({ code: 'P0001', message: 'Esa jugada se está grabando ahora: espera a que termine' }, { status: 400 })
        : Response.json('ok');
    });
    const res = await call('POST', '/api/v1/admin/clips/reject', { ids: [C1, C2], reason: 'mal' });
    expect(await res.json()).toEqual({
      results: [{ id: C1, ok: true, error: null }, { id: C2, ok: false, error: 'Esa jugada se está grabando ahora: espera a que termine' }],
    });
    const rec = await call('POST', '/api/v1/admin/clips/restore', { ids: [C1] });
    expect(await rec.json()).toEqual({ results: [{ id: C1, ok: true, error: null }] });
    expect(rpcs().map((r) => r.fn)).toEqual(['clip_reject', 'clip_reject', 'clip_unreject']);
  });

  it('un usuario común no puede', async () => {
    postgrest(() => undefined, 'user');
    expect((await call('POST', `/api/v1/admin/clips/${C1}/reject`)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/clips/restore', { ids: [C1] })).status).toBe(403);
  });

  it('la lista de rechazados sale de match_clip_ranked, con quién, cuándo y si se puede recuperar', async () => {
    postgrest((url) => {
      if (url.pathname.endsWith('/match_clip_ranked')) {
        return Response.json([{ ...row(C1, 1), review: 'rejected', video_status: null, created_at: '2026-11-02T20:00:00Z' }], {
          headers: { 'Content-Range': '0-0/1' },
        });
      }
      if (url.pathname.endsWith('/match_clips')) {
        return Response.json([{ id: C1, video_reprocess_count: 4, discord_posted_at: null, video_rejected_at: '2026-11-05T16:02:00Z', video_rejected_by: USER, video_reject_reason: 'mal' }]);
      }
      return clipsAndMatch(url);
    });
    const res = await call('GET', '/api/v1/admin/clips?status=rejected');
    expect(res.status).toBe(200);
    const b = (await res.json()) as { items: { can_reprocess: boolean; rejected: unknown; clip: { review: string } }[] };
    expect(b.items[0]).toMatchObject({
      can_reprocess: false,
      rejected: { at: '2026-11-05T16:02:00Z', by: { id: USER, alias: 'Daniel' }, reason: 'mal', can_restore: true },
      clip: { review: 'rejected' },
    });
    const q = calls.find((c) => c.url.pathname.endsWith('/match_clip_ranked'))!.url;
    expect(q.searchParams.get('review')).toBe('eq.rejected');
    expect(calls.some((c) => c.url.pathname.endsWith('/match_clip_list'))).toBe(false);
  });

  it('los topes de destacados van por clip_set_featured', async () => {
    postgrest((url) => (url.pathname.endsWith('/clip_config') ? Response.json(CONFIG) : url.pathname.includes('/rpc/') ? Response.json(null) : undefined));
    const res = await call('PATCH', '/api/v1/admin/clips/config', { featured_max: 4 });
    expect(res.status).toBe(200);
    expect(rpcs()).toContainEqual({ fn: 'clip_set_featured', body: { p_max: 4, p_max_vip: 10 } });
    expect((await call('PATCH', '/api/v1/admin/clips/config', { featured_max: 0 })).status).toBe(400);
  });
});
