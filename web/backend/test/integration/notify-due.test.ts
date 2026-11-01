import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { runNotifyDue } from '../../src/jobs/notify-due';
import { admin, createUser, local, localEnv } from './local';

// Notificaciones programadas contra la Supabase local (replanteo 35, plan docs/bitacora/2026-10-29-notificaciones-programadas).
// notify_due() también avisa lo que venza en los datos de la base local: acá solo se mira a las cuentas de la prueba.
const app = createApp();
const env = localEnv();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const ids = { p1: crypto.randomUUID(), p2: crypto.randomUUID(), t1: crypto.randomUUID(), t2: crypto.randomUUID(), m: crypto.randomUUID() };
let u1: { id: string; token: string };
let u2: { id: string; token: string };

const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const types = async (token: string) => {
  const res = await app.request('/api/v1/notifications?per=100', { headers: { Authorization: `Bearer ${token}` } }, env);
  expect(res.status).toBe(200);
  return ((await res.json()).items as { type: string; data: Record<string, unknown> }[]);
};

beforeAll(async () => {
  u1 = await createUser({ tag: `Nd1_${seed}` });
  u2 = await createUser({ tag: `Nd2_${seed}` });
  const a = admin();
  check(await a.from('players').insert([
    // Para entrar a un equipo hace falta SteamID.
    { id: ids.p1, nick: `Nd1_${seed}`, user_id: u1.id, steam_id: `765611980${seed}01` },
    { id: ids.p2, nick: `Nd2_${seed}`, user_id: u2.id, steam_id: `765611980${seed}02` },
  ]));
  check(await a.from('teams').insert([
    { id: ids.t1, name: `NdA${seed}`, tag: 'NDA', kind: 'official', owner_id: u1.id, captain_id: u1.id },
    { id: ids.t2, name: `NdB${seed}`, tag: 'NDB', kind: 'official', owner_id: u2.id, captain_id: u2.id },
  ]));
  check(await a.from('team_members').insert([
    { team_id: ids.t1, player_id: ids.p1, joined_at: new Date().toISOString() },
    { team_id: ids.t2, player_id: ids.p2, joined_at: new Date().toISOString() },
  ]));
  const startsAt = new Date(Date.now() + 30 * 60_000).toISOString();
  check(await a.from('matches').insert({ id: ids.m, kind: 'official', status: 'upcoming', team1: ids.t1, team2: ids.t2, best_of: 1, starts_at: startsAt }));
  check(await a.from('vip_memberships').insert({
    user_id: u2.id, source: 'manual',
    starts_at: new Date(Date.now() - 30 * 86_400_000).toISOString(), ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  }));
});

afterAll(async () => {
  const a = admin();
  await a.from('notification_sent').delete().like('ref', `%${ids.m}%`);
  await a.from('matches').delete().eq('id', ids.m);
  await a.from('team_members').delete().in('team_id', [ids.t1, ids.t2]);
  await a.from('teams').delete().in('id', [ids.t1, ids.t2]);
  await a.from('vip_memberships').delete().eq('user_id', u2.id);
  await a.from('notifications').delete().in('user_id', [u1.id, u2.id]);
  await a.from('players').delete().in('id', [ids.p1, ids.p2]);
});

describe('notificaciones programadas', () => {
  it('partida en 30 minutos y VIP por vencer, sin repetir', async () => {
    const a = admin();
    const r = await runNotifyDue((fn) => a.rpc(fn));
    expect(r.match_soon).toBeGreaterThanOrEqual(1);

    const n1 = await types(u1.token);
    expect(n1.filter((n) => n.type === 'match_soon')).toHaveLength(1);
    expect(n1.find((n) => n.type === 'match_soon')?.data).toMatchObject({ match_id: ids.m, team1: { name: `NdA${seed}` } });
    const n2 = await types(u2.token);
    expect(n2.filter((n) => n.type === 'match_soon')).toHaveLength(1);
    expect(n2.filter((n) => n.type === 'vip_expiring')).toHaveLength(1);

    await runNotifyDue((fn) => a.rpc(fn));
    expect((await types(u1.token)).filter((n) => n.type === 'match_soon')).toHaveLength(1);
    expect((await types(u2.token)).filter((n) => n.type === 'vip_expiring')).toHaveLength(1);
  });

  it('un usuario no puede correr notify_due', async () => {
    const sb = createClient(local().API_URL, local().ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${u1.token}` } },
    });
    const { error } = await sb.rpc('notify_due');
    expect(error).not.toBeNull();
  });
});
