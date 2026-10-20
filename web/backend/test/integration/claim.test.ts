import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Perfiles sin reclamar, !claim y varios SteamID contra la Supabase local (con el replanteo 15 aplicado).
const app = createApp();
const env = localEnv();
const seed = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
const steam = (n: number) => `7656119${seed}${String(n).padStart(4, '0')}`;
const matchIds = [crypto.randomUUID(), crypto.randomUUID()];
let adminToken: string;
let serverId: string;
let serverToken: string;
const players: string[] = [];

const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const res = await app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
// !claim como el plugin: sin sesión, con el token del servidor.
const plugin = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const claim = async (steamId: string, code: string) => {
  const r = await plugin.rpc('claim_with_code', { p_token: serverToken, p_steam: steamId, p_code: code, p_nick: 'EnElJuego' });
  if (r.error) throw r.error;
  return r.data as { ok: boolean; pending: boolean; message: string; alias: string | null };
};
const newCode = async (token: string) => (await call('POST', '/api/v1/me/claim-code', undefined, token)).body.code as string;

beforeAll(async () => {
  adminToken = (await createUser({ role: 'admin' })).token;
  const srv = await call('POST', '/api/v1/admin/servers', { name: `Claim ${seed}` }, adminToken);
  serverId = srv.body.id;
  serverToken = srv.body.token;
  const a = admin();
  const m = await a.from('matches').insert([
    { id: matchIds[0], kind: 'mix', status: 'finished', map: 'de_dust2', score1: 16, score2: 10, winner_side: 1, played_at: new Date(Date.now() - 2 * 86_400_000).toISOString() },
    { id: matchIds[1], kind: 'mix', status: 'finished', map: 'de_inferno', score1: 16, score2: 10, winner_side: 1, played_at: new Date(Date.now() - 86_400_000).toISOString() },
  ]);
  if (m.error) throw m.error;
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => ({ match_id: matchIds[0], steam_id: steam(i + 1), team: i < 5 ? 1 : 2, nick: `C${seed}n${i + 1}`, rounds: 26, rating: 1 })),
    ...Array.from({ length: 10 }, (_, i) => ({ match_id: matchIds[1], steam_id: steam(i + 11), team: i < 5 ? 1 : 2, nick: `C${seed}n${i + 11}`, rounds: 26, rating: 1 })),
  ];
  const s = await a.from('match_player_stats').insert(rows);
  if (s.error) throw s.error;
  const r = await a.rpc('elo_recompute_all');
  if (r.error) throw r.error;
});

afterAll(async () => {
  const a = admin();
  await a.from('match_player_stats').delete().in('match_id', matchIds);
  await a.from('matches').delete().in('id', matchIds);
  if (players.length) await a.from('players').delete().in('id', players);
  await a.from('game_servers').delete().eq('id', serverId);
  await a.from('claim_config').update({ max_steam_ids: 3 }).eq('id', 1);
  await a.rpc('elo_recompute_all');
});

describe('perfil sin reclamar', () => {
  it('cualquiera lo ve, con stats, partidas y stats por mapa, y no está en el ranking', async () => {
    const p = await call('GET', `/api/v1/players/steam/${steam(1)}`);
    expect(p.status).toBe(200);
    expect(p.body).toMatchObject({ claimed: false, player_id: null, profile: { last_nick: `C${seed}n1`, matches: 1, elo_matches: 1, stats: { wins: 1 } } });
    expect(p.body.profile.elo).toBeGreaterThan(1000);
    const list = await call('GET', `/api/v1/players/unclaimed?q=c${seed}n1&sort=last_nick&order=asc`);
    expect(list.body.items.map((x: { steam_id: string }) => x.steam_id)).toContain(steam(1));
    expect((await call('GET', `/api/v1/players/steam/${steam(1)}/matches`)).body).toMatchObject({ total: 1, items: [{ match_id: matchIds[0], won: true }] });
    expect((await call('GET', `/api/v1/players/steam/${steam(1)}/matches`)).body.items[0].elo_delta).toBeGreaterThan(0);
    expect((await call('GET', `/api/v1/players/steam/${steam(1)}/map-stats`)).body.items).toEqual([expect.objectContaining({ map: 'de_dust2', maps: 1 })]);
    const ranking = await call('GET', `/api/v1/players?q=c${seed}`);
    expect(ranking.body.total).toBe(0);
    expect((await call('GET', '/api/v1/players/steam/76561190000000000')).status).toBe(404);
    expect((await call('GET', '/api/v1/players/steam/123')).status).toBe(400);
  });

  it('el detalle de la partida enlaza a los jugadores sin ficha', async () => {
    const m = await call('GET', `/api/v1/matches/${matchIds[0]}`);
    expect(m.body.players.find((x: { game_nick: string }) => x.game_nick === `C${seed}n1`)).toMatchObject({ player_id: null, steam_id: steam(1) });
  });
});

describe('!claim', () => {
  it('primer SteamID: crea la ficha con el historial; el estado lo muestra', async () => {
    const u = await createUser({ tag: `Cl${seed}` });
    const before = (await call('GET', `/api/v1/players/steam/${steam(1)}`)).body.profile.elo as number;
    const code = await newCode(u.token);
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    let st = await call('GET', '/api/v1/me/claim-code', undefined, u.token);
    expect(st.body).toMatchObject({ steam_ids: [], max_steam_ids: 3, last_code: { code, status: 'pending' }, pending_requests: 0 });

    expect(await claim(steam(1), code)).toMatchObject({ ok: true, pending: false, message: 'Listo: tu cuenta quedó vinculada', alias: `Cl${seed}` });
    st = await call('GET', '/api/v1/me/claim-code', undefined, u.token);
    expect(st.body).toMatchObject({ steam_ids: [{ steam_id: steam(1), is_primary: true }], last_code: { status: 'used', used_steam_id: steam(1) } });

    const prof = await call('GET', `/api/v1/players/steam/${steam(1)}`);
    expect(prof.body).toMatchObject({ claimed: true, profile: null });
    const pid = prof.body.player_id as string;
    players.push(pid);
    const ficha = await call('GET', `/api/v1/players/${pid}`);
    expect(ficha.body).toMatchObject({ alias: `Cl${seed}`, has_account: true, has_steam: true, steam_ids: [steam(1)], elo: before });
    expect((await call('GET', `/api/v1/matches/${matchIds[0]}`)).body.players.find((x: { player_id: string }) => x.player_id === pid)).toMatchObject({ steam_id: null, alias: `Cl${seed}` });

    // Adicional que compartió partida: queda pendiente, pero no se puede aprobar.
    expect(await claim(steam(2), await newCode(u.token))).toMatchObject({ ok: true, pending: true });
    // Adicional sin partidas compartidas: el admin lo aprueba y el ELO se une.
    expect(await claim(steam(11), await newCode(u.token))).toMatchObject({ ok: true, pending: true, message: 'Pedido enviado: un admin lo tiene que aprobar' });
    const mine = await call('GET', '/api/v1/me/steam-requests?status=pending', undefined, u.token);
    expect(mine.body.items.map((x: { steam_id: string }) => x.steam_id).sort()).toEqual([steam(2), steam(11)]);
    expect((await call('GET', '/api/v1/me/claim-code', undefined, u.token)).body.pending_requests).toBe(2);

    const reqs = await call('GET', `/api/v1/admin/steam-requests?q=${seed}&status=pending`, undefined, adminToken);
    const r2 = reqs.body.items.find((x: { steam_id: string }) => x.steam_id === steam(2));
    const r11 = reqs.body.items.find((x: { steam_id: string }) => x.steam_id === steam(11));
    expect(r2).toMatchObject({ shares_match: true, player: { id: pid }, server: { id: serverId }, matches: 1 });
    expect(r11).toMatchObject({ shares_match: false, player_steam_count: 1 });

    const bad = await call('POST', `/api/v1/admin/steam-requests/${r2.id}/approve`, undefined, adminToken);
    expect(bad.status).toBe(400);
    expect(bad.body.error.message).toMatch(/^Ese SteamID jugó una partida junto a otro SteamID de la ficha/);
    expect((await call('POST', `/api/v1/admin/steam-requests/${r2.id}/reject`, { reason: 'Es otra persona' }, adminToken)).status).toBe(204);
    expect((await call('POST', `/api/v1/admin/steam-requests/${r11.id}/approve`, undefined, adminToken)).status).toBe(204);

    const merged = await call('GET', `/api/v1/players/${pid}`);
    expect(merged.body.steam_ids).toEqual([steam(1), steam(11)]);
    expect(merged.body.elo_matches).toBe(2);
    expect(merged.body.elo).toBeGreaterThan(before);
    expect((await call('GET', `/api/v1/players/steam/${steam(11)}`)).body).toMatchObject({ claimed: true, player_id: pid });
    const rejected = await call('GET', '/api/v1/me/steam-requests?status=rejected', undefined, u.token);
    expect(rejected.body.items).toEqual([expect.objectContaining({ steam_id: steam(2), reason: 'Es otra persona' })]);

    // Principal nuevo y quitar uno.
    expect((await call('POST', `/api/v1/admin/steam/${steam(11)}/primary`, undefined, adminToken)).status).toBe(204);
    expect((await call('GET', `/api/v1/players/${pid}`)).body).toMatchObject({ steam_id: steam(11), steam_ids: [steam(11), steam(1)] });
    expect((await call('DELETE', `/api/v1/admin/steam/${steam(1)}`, undefined, adminToken)).status).toBe(204);
    expect((await call('GET', `/api/v1/players/steam/${steam(1)}`)).body).toMatchObject({ claimed: false });
    expect((await call('GET', `/api/v1/players/${pid}`)).body).toMatchObject({ steam_ids: [steam(11)], elo_matches: 1 });

    // Registro de reclamos.
    const log = await call('GET', `/api/v1/admin/claims?steam_id=${steam(11)}`, undefined, adminToken);
    expect(log.body.items[0]).toMatchObject({ ok: true, result: 'Pedido enviado: un admin lo tiene que aprobar', nick: 'EnElJuego', server: { id: serverId } });
  });

  it('rechazos: código usado, SteamID de otra cuenta, tope y permisos', async () => {
    const u = await createUser({ tag: `Cx${seed}` });
    const code = await newCode(u.token);
    expect(await claim(steam(5), code)).toMatchObject({ ok: true });
    players.push((await call('GET', `/api/v1/players/steam/${steam(5)}`)).body.player_id);
    expect(await claim(steam(6), code)).toMatchObject({ ok: false, message: 'Código inválido o vencido: generá otro en la web (Mi perfil)' });

    const otro = await createUser();
    expect(await claim(steam(5), await newCode(otro.token))).toMatchObject({ ok: false, message: 'Ese SteamID pertenece a otra cuenta' });

    // Tope en 1: ya no puede pedir adicionales.
    expect((await call('PUT', '/api/v1/admin/steam/config', { max_steam_ids: 5 }, adminToken)).status).toBe(400);
    expect((await call('PUT', '/api/v1/admin/steam/config', { max_steam_ids: 1 }, adminToken)).body).toEqual({ max_steam_ids: 1 });
    expect((await call('GET', '/api/v1/admin/steam/config', undefined, adminToken)).body).toEqual({ max_steam_ids: 1 });
    expect(await claim(steam(7), await newCode(u.token))).toMatchObject({ ok: false, message: 'Llegaste al máximo de SteamID: pedíselo a un admin' });
    await call('PUT', '/api/v1/admin/steam/config', { max_steam_ids: 3 }, adminToken);

    // Sin sesión no hay código; un usuario común no ve lo del admin.
    expect((await call('POST', '/api/v1/me/claim-code')).status).toBe(401);
    for (const path of ['/api/v1/admin/steam-requests', '/api/v1/admin/claims', '/api/v1/admin/steam/config'])
      expect((await call('GET', path, undefined, u.token)).status).toBe(403);
    expect((await call('DELETE', `/api/v1/admin/steam/${steam(5)}`, undefined, u.token)).status).toBe(403);
  });

  it('el jugador elige su principal y pide desvincular (lo aprueba un admin)', async () => {
    const u = await createUser({ tag: `Cu${seed}` });
    expect(await claim(steam(3), await newCode(u.token))).toMatchObject({ ok: true, pending: false });
    const pid = (await call('GET', `/api/v1/players/steam/${steam(3)}`)).body.player_id as string;
    players.push(pid);
    expect(await claim(steam(13), await newCode(u.token))).toMatchObject({ ok: true, pending: true });
    const add = (await call('GET', `/api/v1/me/steam-requests?kind=add&status=pending`, undefined, u.token)).body.items[0];
    expect(add).toMatchObject({ kind: 'add', steam_id: steam(13), note: null });
    expect((await call('POST', `/api/v1/admin/steam-requests/${add.id}/approve`, undefined, adminToken)).status).toBe(204);

    // Principal: sin aprobación, una vez cada 24 horas.
    // Cada SteamID trae cuándo se vinculó, y la conserva al cambiar el principal.
    const dates = (await call('GET', '/api/v1/me/claim-code', undefined, u.token)).body.steam_ids as { steam_id: string; added_at: string }[];
    expect(dates.map((s) => s.steam_id)).toEqual([steam(3), steam(13)]);
    for (const s of dates) expect(Date.now() - new Date(s.added_at).getTime()).toBeLessThan(60_000);
    const merged = (await call('GET', `/api/v1/players/${pid}`)).body;
    expect(merged).toMatchObject({ steam_id: steam(3), elo_matches: 2 });
    expect((await call('POST', `/api/v1/me/steam/${steam(13)}/primary`)).status).toBe(401);
    expect((await call('POST', `/api/v1/me/steam/${steam(13)}/primary`, undefined, u.token)).status).toBe(204);
    expect((await call('GET', `/api/v1/players/${pid}`)).body).toMatchObject({
      steam_id: steam(13), steam_ids: [steam(13), steam(3)], elo: merged.elo, peak_elo: merged.peak_elo, elo_matches: 2,
    });
    // Recalcular todo da lo mismo que pasar la fila a la clave nueva.
    const r = await admin().rpc('elo_recompute_all');
    if (r.error) throw r.error;
    expect((await call('GET', `/api/v1/players/${pid}`)).body).toMatchObject({ elo: merged.elo, peak_elo: merged.peak_elo, elo_matches: 2 });
    expect((await call('POST', `/api/v1/me/steam/${steam(13)}/primary`, undefined, u.token)).status).toBe(204);
    const again = await call('POST', `/api/v1/me/steam/${steam(3)}/primary`, undefined, u.token);
    expect(again.status).toBe(400);
    expect(again.body.error.message).toMatch(/^Ya cambiaste tu SteamID principal en las últimas 24 horas/);
    expect((await call('POST', `/api/v1/me/steam/${steam(1)}/primary`, undefined, u.token)).body.error.message).toBe('Ese SteamID no es de tu ficha');

    // Desvincular: queda pendiente y reserva el SteamID; el único no se puede.
    const req = await call('POST', `/api/v1/me/steam/${steam(3)}/unlink`, { reason: 'Era la PC de un amigo' }, u.token);
    expect(req.status).toBe(201);
    expect(req.body).toMatchObject({ kind: 'remove', steam_id: steam(3), status: 'pending', note: 'Era la PC de un amigo', reason: null });
    expect((await call('GET', '/api/v1/me/claim-code', undefined, u.token)).body).toMatchObject({
      steam_ids: [
        { steam_id: steam(13), is_primary: true, added_at: dates[1]?.added_at, unlink_pending: false },
        { steam_id: steam(3), is_primary: false, added_at: dates[0]?.added_at, unlink_pending: true },
      ],
      pending_requests: 1,
    });
    expect((await call('POST', `/api/v1/me/steam/${steam(3)}/unlink`, {}, u.token)).body.error.message).toMatch(/^Ya pediste desvincular ese SteamID/);
    expect((await call('POST', `/api/v1/me/steam/${steam(13)}/unlink`, undefined, u.token)).body.error.message).toBe('Es tu único SteamID: no se puede desvincular');
    expect((await call('POST', `/api/v1/me/steam/${steam(1)}/unlink`, undefined, u.token)).body.error.message).toBe('Ese SteamID no es de tu ficha');
    expect((await call('POST', `/api/v1/me/steam/${steam(3)}/unlink`)).status).toBe(401);

    const list = await call('GET', `/api/v1/admin/steam-requests?kind=remove&q=${seed}`, undefined, adminToken);
    expect(list.body.items).toEqual([
      expect.objectContaining({ id: req.body.id, kind: 'remove', note: 'Era la PC de un amigo', shares_match: false, player_steam_count: 2, player: { id: pid, nick: `Cu${seed}` } }),
    ]);
    expect((await call('POST', `/api/v1/admin/steam-requests/${req.body.id}/approve`, undefined, adminToken)).status).toBe(204);
    expect((await call('GET', `/api/v1/players/${pid}`)).body).toMatchObject({ steam_ids: [steam(13)], elo_matches: 1 });
    expect((await call('GET', `/api/v1/players/steam/${steam(3)}`)).body).toMatchObject({ claimed: false });
    expect((await call('GET', '/api/v1/me/steam-requests?kind=remove', undefined, u.token)).body.items).toEqual([
      expect.objectContaining({ steam_id: steam(3), status: 'approved' }),
    ]);

    // Sin body; con el pedido pendiente no puede ser principal; si el admin lo quita directo, el pedido queda aprobado.
    expect((await call('POST', '/api/v1/admin/steam/link', { steam_id: steam(14), player_id: pid }, adminToken)).status).toBe(204);
    const r14 = await call('POST', `/api/v1/me/steam/${steam(14)}/unlink`, undefined, u.token);
    expect(r14.body).toMatchObject({ kind: 'remove', steam_id: steam(14), note: null });
    expect((await call('POST', `/api/v1/me/steam/${steam(14)}/primary`, undefined, u.token)).body.error.message).toMatch(/^Ese SteamID tiene un pedido para desvincularlo/);
    expect((await call('DELETE', `/api/v1/admin/steam/${steam(14)}`, undefined, adminToken)).status).toBe(204);
    expect((await call('GET', `/api/v1/me/steam-requests?kind=remove&status=approved`, undefined, u.token)).body.total).toBe(2);
    expect((await call('GET', `/api/v1/players/${pid}`)).body.steam_ids).toEqual([steam(13)]);

    // Cancelar el pedido mientras está pendiente: queda cancelled, el SteamID sigue en la ficha y se puede volver a pedir.
    expect((await call('POST', '/api/v1/admin/steam/link', { steam_id: steam(15), player_id: pid }, adminToken)).status).toBe(204);
    const r15 = (await call('POST', `/api/v1/me/steam/${steam(15)}/unlink`, undefined, u.token)).body;
    expect((await call('DELETE', `/api/v1/me/steam/${steam(15)}/unlink`)).status).toBe(401);
    expect((await call('DELETE', `/api/v1/me/steam/${steam(15)}/unlink`, undefined, u.token)).status).toBe(204);
    expect((await call('GET', '/api/v1/me/steam-requests?status=cancelled', undefined, u.token)).body.items).toEqual([
      expect.objectContaining({ id: r15.id, kind: 'remove', steam_id: steam(15), status: 'cancelled', resolved_at: expect.any(String) }),
    ]);
    expect((await call('GET', '/api/v1/me/claim-code', undefined, u.token)).body).toMatchObject({
      steam_ids: [{ steam_id: steam(13), unlink_pending: false }, { steam_id: steam(15), unlink_pending: false }],
      pending_requests: 0,
    });
    const twice = await call('DELETE', `/api/v1/me/steam/${steam(15)}/unlink`, undefined, u.token);
    expect(twice.status).toBe(400);
    expect(twice.body.error.message).toBe('No tenés un pedido pendiente para desvincular ese SteamID');
    expect((await call('POST', `/api/v1/admin/steam-requests/${r15.id}/approve`, undefined, adminToken)).body.error.message).toBe('La solicitud ya no está pendiente (cancelled)');
    expect((await call('GET', `/api/v1/admin/steam-requests?status=cancelled&q=${seed}`, undefined, adminToken)).body.items).toEqual([
      expect.objectContaining({ id: r15.id, status: 'cancelled' }),
    ]);
    expect((await call('POST', `/api/v1/me/steam/${steam(15)}/unlink`, undefined, u.token)).status).toBe(201);
  });

  it('el servidor sin licencia no vincula', async () => {
    const r = await plugin.rpc('claim_with_code', { p_token: 'no-existe', p_steam: steam(8), p_code: 'AAAAAA', p_nick: 'x' });
    expect(r.data).toMatchObject({ ok: false, message: 'Este servidor no tiene una licencia válida de CSSTV' });
  });
});
