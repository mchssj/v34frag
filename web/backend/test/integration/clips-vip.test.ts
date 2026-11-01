import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Clips VIP y reprocesar contra la Supabase local (migración 20261028180000_clips_vip_reprocesar y replanteo 26,
// plan docs/bitacora/2026-10-28-clips-vip-y-reprocesar). No cambia clip_config: usa el vip_per_match que haya.
const app = createApp();
const env = localEnv();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const s64 = (i: number) => `7656119${seed}${String(i).padStart(4, '0')}`;
const matchId = crypto.randomUUID();
const vipPlayer = crypto.randomUUID();
const nick = `CVip${seed}`;
let adminToken: string;
let userToken: string;
let vipUser: string;
let vipPerMatch: number;

const call = (method: string, path: string, body?: unknown, token: string | null = adminToken) =>
  app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const list = async (token: string | null = null) => (await call('GET', `/api/v1/matches/${matchId}/clips?per=50`, undefined, token)).json() as Promise<any>;
const done = (id: string, suffix: string) => ({
  video_status: 'done', video_key: `clips/${matchId}/${id}-${suffix}.mp4`, video_bytes: 1000, video_seconds: 10,
  video_drive_id: `drive${suffix}${seed}`, video_rendered_at: new Date().toISOString(),
});

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  userToken = (await createUser()).token;
  const vip = await createUser({ tag: nick });
  vipUser = vip.id;
  const a = admin();
  vipPerMatch = check(await a.from('clip_config').select('vip_per_match').eq('id', 1).single()).data!.vip_per_match;
  check(await a.from('players').insert({ id: vipPlayer, nick, steam_id: s64(0), user_id: vipUser }));
  check(await a.from('vip_memberships').insert({ user_id: vipUser, starts_at: '2000-01-01', source: 'import' }));
  check(await a.from('matches').insert({
    id: matchId, kind: 'mix', status: 'finished', map: 'de_dust2', score1: 13, score2: 7, winner_side: 1, tickrate: 66,
    played_at: new Date().toISOString(), demo_status: 'uploaded',
  }));
  // El VIP: vipPerMatch + 1 jugadas (una queda afuera). Uno normal: 1.
  check(await a.from('match_clips').insert([
    ...Array.from({ length: vipPerMatch + 1 }, (_, i) => ({
      match_id: matchId, round: i + 1, player_steamid: s64(0), player_name: 'vip', round_won: true, kill_ticks: [i * 1000 + 1, i * 1000 + 2, i * 1000 + 3],
    })),
    { match_id: matchId, round: 20, player_steamid: s64(1), player_name: 'normal', round_won: true, kill_ticks: [20001, 20002, 20003, 20004] },
  ]));
});

afterAll(async () => {
  const a = admin();
  await a.from('match_clips').delete().eq('match_id', matchId);
  await a.from('matches').delete().eq('id', matchId);
  await a.from('vip_memberships').delete().eq('user_id', vipUser);
  await a.from('players').delete().eq('id', vipPlayer);
});

describe('clips VIP', () => {
  it('el VIP suma sus clips aparte del top, después de él', async () => {
    const body = await list();
    const vips = body.items.filter((c: any) => c.vip);
    expect(vips).toHaveLength(vipPerMatch);
    expect(vips.every((c: any) => c.player?.id === vipPlayer)).toBe(true);
    const normal = body.items.find((c: any) => !c.vip);
    expect(normal.position).toBe(1);
    expect(Math.min(...vips.map((c: any) => c.position))).toBe(2);
  });

  it('vip_per_match en la configuración del admin', async () => {
    const cfg = await (await call('GET', '/api/v1/admin/clips/config')).json();
    expect(cfg.config.vip_per_match).toBe(vipPerMatch);
  });
});

describe('reprocesar', () => {
  let clipId: string;

  it('solo un admin, y solo un clip ya grabado', async () => {
    clipId = (await list()).items.find((c: any) => !c.vip).id;
    expect((await call('POST', `/api/v1/admin/clips/${clipId}/reprocess`, undefined, userToken)).status).toBe(403);
    const res = await call('POST', `/api/v1/admin/clips/${clipId}/reprocess`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatchObject({ code: 'BUSINESS_RULE', message: 'Esa jugada todavía no se grabó: ya está en la cola' });
    expect((await call('POST', `/api/v1/admin/clips/${crypto.randomUUID()}/reprocess`)).status).toBe(404);
  });

  it('de punta a punta: reprocesar, esconderlo hasta el "Bien" y aprobarlo', async () => {
    const a = admin();
    check(await a.from('match_clips').update(done(clipId, 'abcd')).eq('id', clipId));

    const res = await call('POST', `/api/v1/admin/clips/${clipId}/reprocess`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: clipId, review: 'pending', video: { status: 'pending' } });

    const queue = await (await call('GET', '/api/v1/admin/clips/review?per=100')).json();
    const item = queue.items.find((x: any) => x.clip.id === clipId);
    expect(item).toMatchObject({ match: { id: matchId, map: 'de_dust2' }, reprocess_count: 1 });

    const early = await call('POST', `/api/v1/admin/clips/${clipId}/approve`);
    expect(early.status).toBe(400);
    expect((await early.json()).error.message).toBe('El video nuevo todavía no está listo');

    // El bot lo graba de nuevo: el admin lo ve; los demás, en cola y sin video.
    check(await a.from('match_clips').update(done(clipId, 'efgh')).eq('id', clipId));
    expect((await list(adminToken)).items.find((c: any) => c.id === clipId)).toMatchObject({ review: 'pending', video: { status: 'done' } });
    expect((await list()).items.find((c: any) => c.id === clipId)).toMatchObject({ review: null, video: { status: 'pending', embed_url: null } });

    const ok = await call('POST', `/api/v1/admin/clips/${clipId}/approve`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ review: 'approved' });
    expect((await list()).items.find((c: any) => c.id === clipId).video.status).toBe('done');
    const after = await (await call('GET', '/api/v1/admin/clips/review?per=100')).json();
    expect(after.items.some((x: any) => x.clip.id === clipId)).toBe(false);
  });
});
