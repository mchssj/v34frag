import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Widget para streamers contra la Supabase local con el replanteo 110 (bitácora 2026-11-10-widget-streamers-en-main).
const app = createApp();
const env = localEnv();

const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

async function get(path: string) {
  const res = await app.request(path, {}, env);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

async function put(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await app.request(path, { method: 'PUT', headers, body: JSON.stringify(body) }, env);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

let playerId = '';
let nick = '';
beforeAll(async () => {
  const db = admin();
  const sid = steam();
  nick = `wdg${Math.random().toString(36).slice(2, 8)}`;
  const p = await db.from('players').insert({ nick, steam_id: sid }).select('id').single();
  if (p.error) throw p.error;
  playerId = p.data.id as string;
  const m = await db
    .from('matches')
    .insert({ kind: 'mix', status: 'finished', best_of: 1, side1_name: 'a', side2_name: 'b', map: 'de_dust2', played_at: new Date(Date.now() - 3600_000).toISOString(), score1: 13, score2: 7, winner_side: 1 })
    .select('id')
    .single();
  if (m.error) throw m.error;
  const s = await db.from('match_player_stats').insert({
    match_id: m.data.id, steam_id: sid, player_id: playerId, nick, team: 1, kills: 20, deaths: 10, assists: 2, headshots: 9, damage: 2000, rounds: 20,
    k1: 8, k2: 3, k3: 2, k4: 0, k5: 0, first_kills: 3, elo_delta: 18,
  });
  if (s.error) throw s.error;
});

describe('GET /api/v1/players/{id}/widget', () => {
  it('sin sesión, por id: los datos del período y caché de 30 s', async () => {
    const since = new Date(Date.now() - 2 * 3600_000).toISOString();
    const r = await get(`/api/v1/players/${playerId}/widget?period=today&since=${encodeURIComponent(since)}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=30');
    expect(r.body).toMatchObject({ id: playerId, nick, period: { v: 1, d: 0, e: 0, elo: 18, kills: 20, k3: 2, entries: 3 } });
    expect(r.body.ultimos[0]).toEqual({ r: 'V', elo: 18 });
  });

  it('trae la foto de la ficha, o null si no tiene (replanteo 111)', async () => {
    const r = await get(`/api/v1/players/${playerId}/widget?period=all`);
    expect(r.status).toBe(200);
    expect(r.body.photo_url).toBeNull();
    const url = 'https://example.com/foto-widget.png';
    const u = await admin().from('players').update({ photo_url: url }).eq('id', playerId);
    if (u.error) throw u.error;
    const r2 = await get(`/api/v1/players/${playerId}/widget?period=24h`);
    expect(r2.body.photo_url).toBe(url);
  });

  it('también por nick, y con los otros períodos', async () => {
    for (const period of ['24h', 'season', 'all']) {
      const r = await get(`/api/v1/players/${nick}/widget?period=${period}`);
      expect(r.status).toBe(200);
      expect(r.body.id).toBe(playerId);
    }
  });

  it('ficha que no existe: 404', async () => {
    const r = await get('/api/v1/players/00000000-0000-4000-8000-000000000000/widget');
    expect(r.status).toBe(404);
  });

  it('guardar (replanteo 112): solo el dueño, y sin período usa el guardado', async () => {
    const r0 = await get(`/api/v1/players/${playerId}/widget`);
    expect(r0.status).toBe(200);
    expect(r0.body.settings).toBeNull();

    // Sin sesión: 401. Con sesión pero sin ficha: 400 con un mensaje claro.
    expect((await put('/api/v1/me/widget', { query: 'd=stats' })).status).toBe(401);
    const otro = await createUser();
    const sin = await put('/api/v1/me/widget', { query: 'd=stats' }, otro.token);
    expect(sin.status).toBe(400);
    expect(sin.body.error.message).toMatch(/ficha de jugador vinculada/);

    // El dueño guarda. Texto inválido: 400 antes de llegar a la base.
    const duenio = await createUser();
    const v = await admin().from('players').update({ user_id: duenio.id }).eq('id', playerId);
    if (v.error) throw v.error;
    expect((await put('/api/v1/me/widget', { query: 'f=<b>' }, duenio.token)).status).toBe(400);
    const ok = await put('/api/v1/me/widget', { query: 'd=stats&v=historico&h=photo' }, duenio.token);
    expect(ok.status).toBe(200);
    expect(ok.body.query).toBe('d=stats&v=historico&h=photo');

    // OBS sin período ve lo guardado; "since" sin período también vale.
    const since = encodeURIComponent(new Date(Date.now() - 2 * 3600_000).toISOString());
    const r1 = await get(`/api/v1/players/${playerId}/widget?since=${since}`);
    expect(r1.status).toBe(200);
    expect(r1.body.settings).toBe('d=stats&v=historico&h=photo');
    expect(r1.body.period.v).toBe(1);
  });

  it('parámetros inválidos: 400', async () => {
    const old = new Date(Date.now() - 72 * 3600_000).toISOString();
    for (const q of ['period=semana', `period=all&since=${encodeURIComponent(new Date().toISOString())}`, `since=${encodeURIComponent(old)}`, 'since=ayer']) {
      const r = await get(`/api/v1/players/${playerId}/widget?${q}`);
      expect(r.status, q).toBe(400);
    }
  });
});
