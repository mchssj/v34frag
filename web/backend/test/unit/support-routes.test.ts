import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BanCreate, BanPatch } from '../../src/schemas/bans';
import { json, makeApp, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Rol Soporte (replanteo 117, bitácora 2026-11-13-rol-soporte) con PostgREST simulado. Los topes de verdad (120 minutos,
// ya baneado, 3 por semana, solo los suyos) los prueba la base: pruebas/probar_117.sql. Acá, que la API deje pasar al
// soporte a lo suyo, le cierre lo demás y arme bien las llamadas.
const USER = '77777777-7777-4777-8777-777777777777';
const BAN = '0b0b0b0b-0000-4000-8000-000000000001';
const PLAYER = 'dddddddd-0000-4000-8000-000000000001';
const TEAM = 'eeeeeeee-0000-4000-8000-000000000001';
const S = '76561198000000001';
type Role = 'admin' | 'moderator' | 'support' | 'user';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Call = { method: string; url: string; body: string | null };
function postgrest(role: Role, handler: (url: URL) => Response | undefined = () => undefined) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const raw = String(input instanceof Request ? input.url : input);
      const method = (input instanceof Request ? input.method : init.method) ?? 'GET';
      calls.push({ method, url: decodeURIComponent(raw), body: typeof init.body === 'string' ? init.body : null });
      if (raw.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      const url = new URL(raw);
      if (url.pathname.endsWith('/profiles') && url.searchParams.get('select') === 'role') return Response.json([{ role }]);
      if (url.pathname.includes('/storage/v1/')) return Response.json([]);
      return handler(url) ?? new Response('no simulado: ' + raw, { status: 599 });
    }),
  );
  return calls;
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

const banRow = {
  id: BAN, player_id: PLAYER, nick: 'Ficha', steam_id: S, reason: 'Tóxico', created_at: '2026-11-13T00:00:00Z',
  expires_at: '2026-11-13T00:30:00Z', permanent: false, status: 'active', source: 'web', server_id: null, server_name: null,
  created_by: USER, created_by_alias: 'Sop', created_by_name: null, lifted_at: null, lift_reason: null, lifted_by: null,
  lifted_by_alias: null, lifted_by_name: null, replaced_by: null,
};
/** Responde las RPC por nombre (y ban_list con el baneo). */
const rpcs = (map: Record<string, unknown>) => (url: URL) => {
  if (url.pathname.endsWith('/ban_list')) return Response.json(banRow);
  const fn = url.pathname.match(/\/rpc\/([a-z_]+)$/)?.[1];
  return fn && fn in map ? Response.json(map[fn]) : undefined;
};
const rpcBody = (calls: Call[], fn: string) => JSON.parse(calls.find((x) => x.url.includes(`/rpc/${fn}`))!.body!);
const rpcCount = (calls: Call[], fn: string) => calls.filter((x) => x.url.includes(`/rpc/${fn}`)).length;

describe('esquemas de baneo con minutos', () => {
  it('minutes de 1 a 120, y uno solo entre minutes, expires_at y permanent', () => {
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', minutes: 30 }).success).toBe(true);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', minutes: 120 }).success).toBe(true);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', minutes: 121 }).success).toBe(false);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', minutes: 0 }).success).toBe(false);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', minutes: 1.5 }).success).toBe(false);
    expect(BanCreate.safeParse({ player_id: PLAYER, reason: 'x', minutes: 30, permanent: true }).success).toBe(false);
    expect(BanPatch.safeParse({ minutes: 45 }).success).toBe(true);
    expect(BanPatch.safeParse({ minutes: 45, expires_at: '2026-12-01T00:00:00Z' }).success).toBe(false);
  });
});

describe('baneos del soporte', () => {
  it('banea por minutos: la API manda el vencimiento desde ahora', async () => {
    const calls = postgrest('support', rpcs({ ban_create: BAN }));
    const before = Date.now();
    const res = await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'Tóxico', minutes: 30 });
    expect(res.status).toBe(201);
    const b = rpcBody(calls, 'ban_create');
    expect(b).toMatchObject({ p_player: PLAYER, p_steam: null, p_reason: 'Tóxico' });
    const ms = Date.parse(b.p_expires) - before;
    expect(ms).toBeGreaterThanOrEqual(30 * 60_000 - 1000);
    expect(ms).toBeLessThanOrEqual(30 * 60_000 + 5000);
  });

  it('no puede usar un vencimiento exacto ni permanente', async () => {
    const calls = postgrest('support', rpcs({ ban_create: BAN }));
    const a = await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'x', expires_at: '2026-12-01T00:00:00Z' });
    const b = await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'x', permanent: true });
    const c = await call('PATCH', `/api/v1/admin/bans/${BAN}`, { permanent: true });
    expect([a.status, b.status, c.status]).toEqual([403, 403, 403]);
    expect(rpcCount(calls, 'ban_create') + rpcCount(calls, 'ban_update')).toBe(0);
  });

  it('cambia con minutos y levanta', async () => {
    const calls = postgrest('support', rpcs({ ban_update: null, ban_lift: null }));
    expect((await call('PATCH', `/api/v1/admin/bans/${BAN}`, { minutes: 10 })).status).toBe(200);
    expect(rpcBody(calls, 'ban_update')).toMatchObject({ p_id: BAN, p_reason: null, p_permanent: false });
    expect((await call('POST', `/api/v1/admin/bans/${BAN}/lift`, { reason: 'Se calmó' })).status).toBe(200);
    expect(rpcBody(calls, 'ban_lift')).toEqual({ p_id: BAN, p_reason: 'Se calmó' });
  });

  it('el moderador sigue pudiendo banear con fecha', async () => {
    const calls = postgrest('moderator', rpcs({ ban_create: BAN }));
    const res = await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'x', expires_at: '2026-12-01T00:00:00Z' });
    expect(res.status).toBe(201);
    expect(rpcBody(calls, 'ban_create').p_expires).toBe('2026-12-01T00:00:00Z');
  });

  it('el cupo de la semana', async () => {
    const quota = { used: 2, max: 3, remaining: 1, banned: false, banned_until: null, permanent: false };
    const calls = postgrest('support', rpcs({ ban_support_quota: quota }));
    const res = await call('GET', `/api/v1/admin/bans/support-quota?steam_id=${S}`);
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual(quota);
    expect(rpcBody(calls, 'ban_support_quota')).toEqual({ p_player: null, p_steam: S });
    expect((await call('GET', '/api/v1/admin/bans/support-quota')).status).toBe(400);
  });

  it('un usuario común no ve el cupo ni banea', async () => {
    const calls = postgrest('user');
    expect((await call('GET', `/api/v1/admin/bans/support-quota?player_id=${PLAYER}`)).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/bans', { player_id: PLAYER, reason: 'x', minutes: 5 })).status).toBe(403);
    expect(calls.some((x) => x.url.includes('/rpc/'))).toBe(false);
  });
});

describe('actividad del soporte', () => {
  it('el soporte no la ve', async () => {
    const calls = postgrest('support');
    expect((await call('GET', '/api/v1/admin/support-actions')).status).toBe(403);
    expect(calls.some((x) => x.url.includes('/rpc/'))).toBe(false);
  });

  it('el moderador la ve paginada y con filtros', async () => {
    const item = {
      id: 7, action: 'photo_remove', created_at: '2026-11-13T01:00:00Z', actor: { id: PLAYER, alias: 'Sop' }, player: null, team: null,
      reason: 'Foto ofensiva', target: { player_id: PLAYER },
    };
    const calls = postgrest('moderator', rpcs({ support_actions_list: { total: 41, items: [item] } }));
    const res = await call('GET', `/api/v1/admin/support-actions?action=photo_remove&page=3&per=20&order=asc&actor=${USER}`);
    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ items: [item], total: 41, page: 3, per: 20, order: 'asc' });
    expect(rpcBody(calls, 'support_actions_list')).toEqual({
      p_actor: USER, p_action: 'photo_remove', p_order: 'asc', p_limit: 20, p_offset: 40,
    });
  });
});

describe('lo demás del soporte', () => {
  it('reprocesa hasta 10 clips por vez', async () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const calls = postgrest('support', rpcs({ clip_reprocess: 'pending' }));
    const big = await call('POST', '/api/v1/admin/clips/reprocess', { ids: ids(11) });
    expect(big.status).toBe(400);
    expect(rpcCount(calls, 'clip_reprocess')).toBe(0);
    const ok = await call('POST', '/api/v1/admin/clips/reprocess', { ids: ids(10) });
    expect(ok.status).toBe(200);
    expect(rpcCount(calls, 'clip_reprocess')).toBe(10);
  });

  it('el moderador también reprocesa hasta 10', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const calls = postgrest('moderator', rpcs({ clip_reprocess: 'pending' }));
    expect((await call('POST', '/api/v1/admin/clips/reprocess', { ids })).status).toBe(400);
    expect(rpcCount(calls, 'clip_reprocess')).toBe(0);
  });

  it('el admin sigue reprocesando hasta 50', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const calls = postgrest('admin', rpcs({ clip_reprocess: 'pending' }));
    expect((await call('POST', '/api/v1/admin/clips/reprocess', { ids })).status).toBe(200);
    expect(rpcCount(calls, 'clip_reprocess')).toBe(30);
  });

  it('entra a Para revisar, publica y rechaza de a uno, pero no rechaza varios ni recupera', async () => {
    const id = 'cccccccc-0000-4000-8000-000000000001';
    // Pasan el permiso de la API (lo demás de cada ruta no está simulado acá; la base lo prueba en probar_117.sql).
    postgrest('support');
    expect((await call('GET', '/api/v1/admin/clips/review')).status).not.toBe(403);
    expect((await call('POST', `/api/v1/admin/clips/${id}/approve`)).status).not.toBe(403);
    expect((await call('POST', `/api/v1/admin/clips/${id}/reject`, { reason: 'Sigue mal' })).status).not.toBe(403);
    expect((await call('POST', '/api/v1/admin/clips/reject', { ids: [id] })).status).toBe(403);
    expect((await call('POST', '/api/v1/admin/clips/restore', { ids: [id] })).status).toBe(403);
  });

  it('quita la foto de perfil con motivo', async () => {
    const calls = postgrest('support', rpcs({ staff_remove_photo: { photo_url: null, avatar_url: null } }));
    expect((await call('POST', `/api/v1/admin/players/${PLAYER}/photo/remove`, { reason: 'no' })).status).toBe(400);
    const res = await call('POST', `/api/v1/admin/players/${PLAYER}/photo/remove`, { reason: 'Foto ofensiva' });
    expect(res.status).toBe(204);
    expect(rpcBody(calls, 'staff_remove_photo')).toEqual({ p_player: PLAYER, p_reason: 'Foto ofensiva' });
  });

  it('un usuario común no quita fotos', async () => {
    const calls = postgrest('user');
    expect((await call('POST', `/api/v1/admin/players/${PLAYER}/photo/remove`, { reason: 'Foto ofensiva' })).status).toBe(403);
    expect(calls.some((x) => x.url.includes('/rpc/'))).toBe(false);
  });

  it('quita el logo de un equipo, pero no lo modera', async () => {
    const calls = postgrest('support', rpcs({ team_staff_remove_logo: null }));
    expect((await call('POST', `/api/v1/admin/teams/${TEAM}/logo/remove`, { reason: 'Logo ofensivo' })).status).toBe(204);
    expect(rpcBody(calls, 'team_staff_remove_logo')).toEqual({ p_team: TEAM, p_reason: 'Logo ofensivo' });
    expect((await call('PATCH', `/api/v1/admin/teams/${TEAM}`, { name: 'Otro', reason: 'x' })).status).toBe(403);
    expect((await call('GET', '/api/v1/admin/teams')).status).toBe(403);
  });

  it('levanta sanciones de la cola, pero no ve las exclusiones', async () => {
    const calls = postgrest('support', rpcs({ mm_admin_lift_penalty: null, mm_admin_lists: [] }));
    expect((await call('GET', '/api/v1/admin/mm/penalties')).status).toBe(200);
    const res = await call('POST', `/api/v1/admin/mm/penalties/${USER}/lift`, { reason: 'Se le cayó el juego' });
    expect(res.status).toBe(200);
    expect(rpcBody(calls, 'mm_admin_lift_penalty')).toEqual({ p_user: USER, p_reason: 'Se le cayó el juego' });
    expect((await call('GET', '/api/v1/admin/mm/bans')).status).toBe(403);
  });

  it('ve y resuelve las denuncias de comentarios', async () => {
    const calls = postgrest('support', rpcs({ profile_comment_reports_admin: { total: 0, items: [] }, profile_comment_report_resolve: null }));
    expect((await call('GET', '/api/v1/admin/profile-comment-reports')).status).toBe(200);
    const id = 'aaaaaaaa-0000-4000-8000-000000000001';
    expect((await call('POST', `/api/v1/admin/profile-comment-reports/${id}/resolve`, { action: 'delete' })).status).toBe(204);
    expect(rpcBody(calls, 'profile_comment_report_resolve')).toEqual({ p_report: id, p_action: 'delete' });
  });
});
