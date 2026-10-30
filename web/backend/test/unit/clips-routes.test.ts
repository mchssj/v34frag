import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Rutas de los clips con PostgREST simulado (sin Docker): validación, armado de cada clip y lo que se le pide a la base.
const USER = '77777777-7777-4777-8777-777777777777';
const MATCH = '88888888-8888-4888-8888-888888888888';
const PLAYER = '99999999-9999-4999-8999-999999999999';
const PRIORITIES = { ace: 1, clutch_5: 2, clutch_4: 2, '4k': 3, clutch_3: 4, '3k': 5, clutch_2: 6, clutch_1: 7 };
const CONFIG = { priorities: PRIORITIES, per_player: 2, per_match: 10, split_gap_seconds: 8, pre_seconds: 3, post_seconds: 2, vip_per_match: 3 };
const ROW = {
  id: '11111111-1111-4111-8111-111111111111', position: 1, type: 'ace', priority: 1, round: 14, round_seconds: 42, round_won: true,
  player_steamid: '76561199900000001', player_id: PLAYER, player_name: 'nickDelJuego', kills: 5, kill_ticks: [6600, 6700, 6800, 6900, 7000],
  clutch_vs: null, clutch_start_tick: null, end_tick: null, tickrate: 66, demo_status: 'uploaded',
  video_status: null, video_key: null, video_seconds: null, video_drive_id: null, video_in_r2: false, vip: false, review: null,
};
const NO_VIDEO = { status: 'pending', url: null, embed_url: null, seconds: null };

let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const calls: { url: URL; body: unknown }[] = [];
function postgrest(handler: (url: URL) => Response | undefined, role: 'admin' | 'user' = 'admin') {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = String(input instanceof Request ? input.url : input);
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles')) return Response.json([{ role, tag: 'AdminTag' }]);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return handler(url) ?? Response.json([]);
    }),
  );
}
const call = async (method: string, path: string, body?: unknown, env = testEnv()) =>
  makeApp().request(
    path,
    {
      method,
      headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const withMatch = (rows: unknown[], extra?: (url: URL) => Response | undefined) => (url: URL) => {
  if (url.pathname.endsWith('/matches')) return Response.json({ id: MATCH });
  if (url.pathname.endsWith('/match_clip_list')) return Response.json(rows, { headers: { 'Content-Range': `0-${rows.length - 1}/${rows.length}` } });
  return extra?.(url);
};

describe('clips: validación', () => {
  it('parámetros del listado', async () => {
    postgrest(() => undefined);
    expect((await call('GET', '/api/v1/matches/no-es-uuid/clips')).status).toBe(400);
    expect((await call('GET', `/api/v1/matches/${MATCH}/clips?sort=kills`)).status).toBe(400);
    expect((await call('GET', `/api/v1/matches/${MATCH}/clips?per=51`)).status).toBe(400);
    expect((await call('GET', `/api/v1/matches/${MATCH}/clips?type=2k`)).status).toBe(400);
    expect((await call('GET', `/api/v1/matches/${MATCH}/clips?player=x`)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('cambiar la configuración: rangos, tipos y cuerpo vacío', async () => {
    postgrest(() => undefined);
    const bad = [
      {},
      { per_player: 0 },
      { per_match: 51 },
      { split_gap_seconds: 61 },
      { pre_seconds: 16 },
      { priorities: { ace: 0 } },
      { priorities: { ace: 1.5 } },
      { priorities: { '5k': 1 } },
      { otra: 1 },
    ];
    for (const b of bad) expect((await call('PATCH', '/api/v1/admin/clips/config', b)).status, JSON.stringify(b)).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe('clips: respuestas', () => {
  it('partida que no existe: 404', async () => {
    postgrest(() => undefined);
    expect((await call('GET', `/api/v1/matches/${MATCH}/clips`)).status).toBe(404);
  });

  it('armado de cada clip: ficha, SteamID del perfil sin reclamar y segundo de la demo', async () => {
    postgrest(
      withMatch(
        [
          ROW,
          { ...ROW, id: '22222222-2222-4222-8222-222222222222', position: 2, type: 'clutch_2', priority: 6, player_id: null,
            player_steamid: '76561199900000002', player_name: 'suelto', kills: 0, kill_ticks: [], clutch_vs: 2, clutch_start_tick: 990, end_tick: 1500 },
          { ...ROW, id: '33333333-3333-4333-8333-333333333333', position: 3, type: '3k', priority: 5, player_id: null,
            player_steamid: 'BOT:3', player_name: 'Bot', kills: 3, kill_ticks: [10, 20, 30], tickrate: null },
        ],
        (url) => (url.pathname.endsWith('/players') ? Response.json([{ id: PLAYER, nick: 'AliasWeb' }]) : undefined),
      ),
    );
    const res = await call('GET', `/api/v1/matches/${MATCH}/clips`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ total: 3, page: 1, per: 20, sort: 'position', order: 'asc' });
    expect(body.items[0]).toEqual({
      id: ROW.id, position: 1, type: 'ace', priority: 1, round: 14, round_seconds: 42, round_won: true,
      player: { id: PLAYER, alias: 'AliasWeb' }, game_nick: 'nickDelJuego', steam_id: null, kills: 5, kill_ticks: ROW.kill_ticks,
      clutch_vs: null, clutch_start_tick: null, end_tick: null, tickrate: 66, demo_seconds: 100, video: NO_VIDEO, vip: false, review: null,
    });
    // Sin kills: la jugada empieza en el inicio del clutch (990 / 66 = 15 s).
    expect(body.items[1]).toMatchObject({ player: null, steam_id: '76561199900000002', clutch_vs: 2, demo_seconds: 15 });
    // Bot y partida sin tickrate.
    expect(body.items[2]).toMatchObject({ player: null, steam_id: null, demo_seconds: null });
  });

  it('video: R2 los primeros días, Drive siempre, y sin demo nunca', async () => {
    const MATCH_ID = '44444444-4444-4444-8444-444444444444';
    const CLIP_ID = '55555555-5555-4555-8555-555555555555';
    const key = `clips/${MATCH_ID}/${CLIP_ID}-20261023190000.mp4`;
    const done = { video_status: 'done', video_key: key, video_seconds: 12.18, video_drive_id: '1AbC-dEf_123' };
    const rows = [
      { ...ROW, ...done, video_in_r2: true },
      { ...ROW, ...done, video_in_r2: false },
      { ...ROW, ...done, video_in_r2: true, video_drive_id: null },
      { ...ROW, video_status: 'processing' },
      { ...ROW, video_status: 'skipped' },
      { ...ROW, demo_status: 'expired' },
      { ...ROW, demo_status: 'pending' },
    ].map((r, i) => ({ ...r, position: i + 1 }));
    postgrest(withMatch(rows));
    const env = testEnv({ CLIPS_BASE_URL: 'https://clips.test/' });
    const items = (await json(await call('GET', `/api/v1/matches/${MATCH}/clips?per=50`, undefined, env))).items;
    const drive = 'https://drive.google.com/file/d/1AbC-dEf_123/preview';
    expect(items.map((c: { video: unknown }) => c.video)).toEqual([
      { status: 'done', url: `https://clips.test/clip/${MATCH_ID}/${CLIP_ID}-20261023190000.mp4`, embed_url: drive, seconds: 12.18 },
      { status: 'done', url: null, embed_url: drive, seconds: 12.18 },
      { status: 'done', url: `https://clips.test/clip/${MATCH_ID}/${CLIP_ID}-20261023190000.mp4`, embed_url: null, seconds: 12.18 },
      { status: 'processing', url: null, embed_url: null, seconds: null },
      { status: 'skipped', url: null, embed_url: null, seconds: null },
      { status: 'unavailable', url: null, embed_url: null, seconds: null },
      NO_VIDEO,
    ]);
    // Sin CLIPS_BASE_URL no hay url: queda el reproductor de Drive.
    postgrest(withMatch(rows.slice(0, 1)));
    expect((await json(await call('GET', `/api/v1/matches/${MATCH}/clips`))).items[0].video).toMatchObject({ url: null, embed_url: drive });
    const q = calls.find((x) => x.url.pathname.endsWith('/match_clip_list'))!.url.searchParams;
    expect(q.get('select')).toContain('video_in_r2');
  });

  it('filtros y orden van a la base', async () => {
    postgrest(withMatch([]));
    await call('GET', `/api/v1/matches/${MATCH}/clips?player=${PLAYER}&type=clutch_3&sort=round&order=desc&page=2&per=5`);
    const q = calls.find((x) => x.url.pathname.endsWith('/match_clip_list'))!.url.searchParams;
    expect(q.get('match_id')).toBe(`eq.${MATCH}`);
    expect(q.get('player_id')).toBe(`eq.${PLAYER}`);
    expect(q.get('type')).toBe('eq.clutch_3');
    expect(q.get('order')).toBe('round.desc.nullslast,position.asc');
    expect(q.get('offset')).toBe('5');
    expect(q.get('limit')).toBe('5');
  });

  it('cambiar la configuración: completa la escala con lo que ya había', async () => {
    postgrest((url) => {
      if (url.pathname.endsWith('/clip_config')) return Response.json({ ...CONFIG, updated_at: '2026-10-23T12:00:00+00:00', updated_by: USER });
      return undefined;
    });
    const res = await call('PATCH', '/api/v1/admin/clips/config', { priorities: { '3k': 1 }, per_match: 12 });
    expect(res.status).toBe(200);
    const rpc = calls.find((x) => x.url.pathname.endsWith('/rpc/clip_set_config'))!;
    expect(rpc.body).toEqual({
      p_priorities: { ...PRIORITIES, '3k': 1 }, p_per_player: 2, p_per_match: 12, p_split_gap_seconds: 8, p_pre_seconds: 3, p_post_seconds: 2,
      p_vip_per_match: 3,
    });
    expect(await json(res)).toMatchObject({ updated_by: { id: USER, alias: 'AdminTag' } });
  });
});

// Clips VIP y reprocesar (plan docs/bitacora/2026-10-28-clips-vip-y-reprocesar). Las reglas las prueba la base:
// pruebas/clips_vip_produccion.sql.
describe('clips: VIP y reprocesar', () => {
  const DONE = { video_status: 'done', video_key: `clips/${MATCH}/x-abcd.mp4`, video_seconds: 9, video_drive_id: 'drive12345678', video_in_r2: true };

  it('vip en cada clip; un reprocesado sin aprobar se muestra en cola, sin video, salvo a un admin', async () => {
    const rows = [{ ...ROW, ...DONE, vip: true, review: 'pending' }];
    postgrest(withMatch(rows), 'user');
    const user = (await json(await call('GET', `/api/v1/matches/${MATCH}/clips`))).items[0];
    expect(user).toMatchObject({ vip: true, review: null, video: NO_VIDEO });
    postgrest(withMatch(rows));
    const admin = (await json(await call('GET', `/api/v1/matches/${MATCH}/clips`))).items[0];
    expect(admin).toMatchObject({ vip: true, review: 'pending', video: { status: 'done', embed_url: expect.stringContaining('drive12345678') } });
  });

  it('cambiar los clips por VIP: va a la base y respeta el rango', async () => {
    postgrest((url) => (url.pathname.endsWith('/clip_config') ? Response.json({ ...CONFIG, updated_at: null, updated_by: null }) : undefined));
    expect((await call('PATCH', '/api/v1/admin/clips/config', { vip_per_match: 11 })).status).toBe(400);
    expect((await call('PATCH', '/api/v1/admin/clips/config', { vip_per_match: 0 })).status).toBe(200);
    expect((calls.find((x) => x.url.pathname.endsWith('/rpc/clip_set_config'))!.body as Record<string, unknown>).p_vip_per_match).toBe(0);
  });

  it('reprocesar y aprobar: solo admins, 404 sin la jugada y devuelven el clip', async () => {
    postgrest(() => undefined, 'user');
    expect((await call('POST', `/api/v1/admin/clips/${ROW.id}/reprocess`)).status).toBe(403);
    postgrest(() => undefined);
    expect((await call('POST', `/api/v1/admin/clips/${ROW.id}/reprocess`)).status).toBe(404);
    expect(calls.some((x) => x.url.pathname.includes('/rpc/'))).toBe(false);

    postgrest((url) => {
      if (url.pathname.endsWith('/match_clips')) return Response.json({ id: ROW.id });
      if (url.pathname.endsWith('/match_clip_list')) return Response.json({ ...ROW, review: 'pending' });
      if (url.pathname.endsWith('/rpc/clip_reprocess')) return Response.json('pending');
      return undefined;
    });
    const res = await call('POST', `/api/v1/admin/clips/${ROW.id}/reprocess`);
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ id: ROW.id, review: 'pending' });
    expect(calls.find((x) => x.url.pathname.endsWith('/rpc/clip_reprocess'))!.body).toEqual({ p_clip: ROW.id });
  });

  it('una regla de la base es BUSINESS_RULE', async () => {
    postgrest((url) => {
      if (url.pathname.endsWith('/match_clips')) return Response.json({ id: ROW.id });
      if (url.pathname.endsWith('/rpc/clip_review_ok'))
        return Response.json({ code: 'P0001', message: 'El video nuevo todavía no está listo' }, { status: 400 });
      return undefined;
    });
    const res = await call('POST', `/api/v1/admin/clips/${ROW.id}/approve`);
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'El video nuevo todavía no está listo' });
  });

  it('para revisar: los pendientes con su mix, del más viejo al más nuevo', async () => {
    postgrest((url) => {
      if (url.pathname.endsWith('/match_clips'))
        return Response.json([{ id: ROW.id, match_id: MATCH, video_reprocess_count: 2, video_reprocessed_at: '2026-10-28T12:00:00Z' }],
          { headers: { 'Content-Range': '0-0/1' } });
      if (url.pathname.endsWith('/match_clip_list')) return Response.json([{ ...ROW, ...DONE, review: 'pending' }]);
      if (url.pathname.endsWith('/matches')) return Response.json([{ id: MATCH, map: 'de_dust2', played_at: '2026-10-27T22:00:00Z' }]);
      return undefined;
    });
    const res = await call('GET', '/api/v1/admin/clips/review');
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items).toEqual([
      expect.objectContaining({
        match: { id: MATCH, map: 'de_dust2', played_at: '2026-10-27T22:00:00Z' }, reprocess_count: 2, reprocessed_at: '2026-10-28T12:00:00Z',
        clip: expect.objectContaining({ id: ROW.id, review: 'pending', video: expect.objectContaining({ status: 'done' }) }),
      }),
    ]);
    const q = calls.find((x) => x.url.pathname.endsWith('/match_clips'))!.url.searchParams;
    expect(q.get('video_review')).toBe('eq.pending');
    expect(q.get('order')).toBe('video_reprocessed_at.asc.nullslast,id.asc');
  });
});
