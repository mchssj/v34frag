import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { admin, createUser, localEnv } from './local';

// Tierlists contra la Supabase local (replanteo 137, bitácora 2026-11-22-tierlists-jugadores-equipos).
const app = createApp();
const env = localEnv();
const rnd = () => Math.random().toString(36).slice(2, 8);

const call = (method: string, path: string, token?: string, body?: unknown) =>
  app.request(
    path,
    {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );

/** Una cuenta con su ficha. */
async function withPlayer() {
  const u = await createUser();
  const { data, error } = await admin().from('players').insert({ nick: `TL${rnd()}${rnd()}`, user_id: u.id }).select('id').single();
  if (error) throw error;
  return { ...u, player: data.id as string };
}

async function create(token: string, kind = 'players', name = 'Mejores AWP') {
  const res = await call('POST', '/api/v1/tierlists', token, { name, kind });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

describe('tierlists', () => {
  it('se crea con S a D, se guarda, se ve sin sesión y en el perfil', async () => {
    const a = await withPlayer();
    const b = await withPlayer();
    const id = await create(a.token);

    let res = await call('GET', `/api/v1/tierlists/${id}`);
    expect(res.status).toBe(200);
    let t = await res.json();
    expect(t.tiers.map((x: { label: string }) => x.label)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(t.is_owner).toBe(false);
    // Arranca con el top del ranking en el banco: fichas, ordenadas por ELO, hasta 30.
    expect(t.bank.length).toBeGreaterThan(0);
    expect(t.bank.length).toBeLessThanOrEqual(30);
    expect(new Set(t.bank.map((i: { kind: string }) => i.kind))).toEqual(new Set(['player']));
    const teams = await (await call('GET', `/api/v1/tierlists/${await create(b.token, 'teams', 'Equipos')}`)).json();
    expect(teams.bank.length).toBeLessThanOrEqual(10);
    expect(teams.bank.every((i: { kind: string }) => i.kind === 'team')).toBe(true);

    res = await call('PUT', `/api/v1/tierlists/${id}`, a.token, {
      name: 'Top',
      tiers: [{ label: 'Dios', items: [{ player: b.player }, { name: 'Uno de afuera' }] }, { label: 'Bien', items: [] }],
      bank: [{ name: 'Sin clasificar' }],
    });
    expect(res.status).toBe(200);
    t = await res.json();
    expect(t.name).toBe('Top');
    expect(t.tiers[0].items.map((i: { kind: string; name: string }) => [i.kind, i.name])).toEqual([
      ['player', expect.any(String)], // el nick de una ficha con cuenta es el alias de la cuenta
      ['external', 'Uno de afuera'],
    ]);
    expect(t.bank).toHaveLength(1);

    // Un equipo no entra en una de jugadores, ni un jugador dos veces; solo el dueño guarda.
    res = await call('PUT', `/api/v1/tierlists/${id}`, a.token, {
      name: 'Top', tiers: [{ label: 'S', items: [{ player: b.player }, { player: b.player }] }], bank: [],
    });
    expect(res.status).toBe(400);
    res = await call('PUT', `/api/v1/tierlists/${id}`, b.token, { name: 'X', tiers: [{ label: 'S', items: [] }], bank: [] });
    expect(res.status).toBe(403);

    res = await call('GET', `/api/v1/players/${a.player}/tierlists`);
    expect((await res.json()).items.map((x: { id: string }) => x.id)).toEqual([id]);
  });

  it('tope de 10 por cuenta, también al copiar', async () => {
    const a = await withPlayer();
    const b = await withPlayer();
    const other = await create(b.token);
    for (let i = 0; i < 10; i++) await create(a.token, 'teams', `L${i}`);
    expect((await call('POST', '/api/v1/tierlists', a.token, { name: 'once', kind: 'players' })).status).toBe(400);
    expect((await call('POST', `/api/v1/tierlists/${other}/copy`, a.token)).status).toBe(400);
  });

  it('copia ajena con tiers e ítems y el crédito a la original; no la propia', async () => {
    const a = await withPlayer();
    const b = await withPlayer();
    const id = await create(a.token);
    await call('PUT', `/api/v1/tierlists/${id}`, a.token, { name: 'Original', tiers: [{ label: 'S', items: [{ name: 'X' }] }], bank: [] });
    expect((await call('POST', `/api/v1/tierlists/${id}/copy`, a.token)).status).toBe(400);
    const res = await call('POST', `/api/v1/tierlists/${id}/copy`, b.token);
    expect(res.status).toBe(201);
    const copy = await (await call('GET', `/api/v1/tierlists/${(await res.json()).id}`, b.token)).json();
    expect(copy.name).toBe('Original (copia)');
    expect(copy.copied_from).toMatchObject({ id, name: 'Original' });
    expect(copy.tiers[0].items[0].name).toBe('X');
    expect(copy.is_owner).toBe(true);
  });

  it('una destacada por perfil', async () => {
    const a = await withPlayer();
    const x = await create(a.token, 'players', 'x');
    const y = await create(a.token, 'players', 'y');
    expect((await call('PUT', `/api/v1/tierlists/${x}/featured`, a.token, { on: true })).status).toBe(204);
    expect((await call('PUT', `/api/v1/tierlists/${y}/featured`, a.token, { on: true })).status).toBe(204);
    const list = await (await call('GET', `/api/v1/players/${a.player}/tierlists`)).json();
    expect(list.items.filter((t: { featured: boolean }) => t.featured).map((t: { id: string }) => t.id)).toEqual([y]);
    expect(list.items[0].id).toBe(y);
  });

  it('me gusta: no a la propia, un aviso la primera vez', async () => {
    const a = await withPlayer();
    const b = await withPlayer();
    const id = await create(a.token);
    expect((await call('PUT', `/api/v1/tierlists/${id}/like`, a.token, { on: true })).status).toBe(400);
    let t = await (await call('PUT', `/api/v1/tierlists/${id}/like`, b.token, { on: true })).json();
    expect([t.likes, t.liked]).toEqual([1, true]);
    await call('PUT', `/api/v1/tierlists/${id}/like`, b.token, { on: false });
    t = await (await call('PUT', `/api/v1/tierlists/${id}/like`, b.token, { on: true })).json();
    expect(t.likes).toBe(1);
    const { count } = await admin().from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', a.id).eq('type', 'tierlist_like');
    expect(count).toBe(1);
  });

  it('comentarios en dos niveles, cerrados y borrados', async () => {
    const a = await withPlayer();
    const b = await withPlayer();
    const c = await withPlayer();
    const id = await create(a.token);
    let res = await call('POST', `/api/v1/tierlists/${id}/comments`, b.token, { body: 'Falta alguien' });
    expect(res.status).toBe(200);
    const top = (await res.json()).items[0];
    res = await call('POST', `/api/v1/tierlists/${id}/comments`, c.token, { body: 'Coincido', parent_id: top.id });
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.items[0].replies.map((r: { body: string }) => r.body)).toEqual(['Coincido']);
    // No se responde una respuesta.
    const reply = list.items[0].replies[0];
    await admin().from('tierlist_comments').update({ created_at: new Date(Date.now() - 60_000).toISOString() }).eq('author', b.id);
    res = await call('POST', `/api/v1/tierlists/${id}/comments`, b.token, { body: 'Y yo', parent_id: reply.id });
    expect(res.status).toBe(400);

    // El dueño borra el comentario: queda "borrado" porque tiene una respuesta.
    expect((await call('DELETE', `/api/v1/tierlist-comments/${top.id}`, a.token)).status).toBe(204);
    let got = await (await call('GET', `/api/v1/tierlists/${id}/comments`)).json();
    expect(got.items[0]).toMatchObject({ deleted: true, body: null, author: null });
    expect(got.items[0].replies).toHaveLength(1);
    expect([got.total, got.threads]).toEqual([1, 1]); // la respuesta cuenta, el borrado no; se pagina uno

    // Cerrados: no se ven ni se dejan.
    expect((await call('PUT', `/api/v1/tierlists/${id}/comments-open`, a.token, { open: false })).status).toBe(204);
    got = await (await call('GET', `/api/v1/tierlists/${id}/comments`)).json();
    expect(got).toEqual({ total: 0, threads: 0, items: [] });
    await admin().from('tierlist_comments').update({ created_at: new Date(Date.now() - 60_000).toISOString() }).eq('author', c.id);
    expect((await call('POST', `/api/v1/tierlists/${id}/comments`, c.token, { body: 'hola' })).status).toBe(403);
  });

  it('denuncias: el moderador borra la tierlist y la denuncia queda', async () => {
    const a = await withPlayer();
    const b = await withPlayer();
    const mod = await createUser({ role: 'admin' });
    const id = await create(a.token, 'players', `Denunciable ${rnd()}`);
    expect((await call('POST', `/api/v1/tierlists/${id}/report`, a.token, { reason: 'spam' })).status).toBe(400);
    expect((await call('POST', `/api/v1/tierlists/${id}/report`, b.token, { reason: 'toxic' })).status).toBe(204);
    expect((await call('POST', `/api/v1/tierlists/${id}/report`, b.token, { reason: 'toxic' })).status).toBe(400);
    expect((await call('GET', '/api/v1/admin/tierlist-reports', b.token)).status).toBe(403);

    const reports = await (await call('GET', '/api/v1/admin/tierlist-reports?per=100', mod.token)).json();
    const r = reports.items.find((x: { tierlist_id: string | null }) => x.tierlist_id === id);
    expect(r).toMatchObject({ target: 'tierlist', removed: false });
    expect((await call('POST', `/api/v1/admin/tierlist-reports/${r.id}/resolve`, mod.token, { action: 'delete' })).status).toBe(204);
    expect((await call('GET', `/api/v1/tierlists/${id}`)).status).toBe(404);
    const after = await (await call('GET', '/api/v1/admin/tierlist-reports?status=resolved&per=100', mod.token)).json();
    expect(after.items.find((x: { id: string }) => x.id === r.id)).toMatchObject({ status: 'removed', removed: true, tierlist_id: null });
  });
});
