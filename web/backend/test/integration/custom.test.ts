import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { nodeMedia } from '../../src/lib/media-node';
import { admin, createUser, localEnv } from './local';

// Avatar y fondo propios y denuncias de imágenes contra la Supabase local con el replanteo 113
// (bitácoras docs/bitacora/2026-11-13-avatar-y-fondo-propios y 2026-11-14-inventario-de-lo-propio). Convierte con el
// ffmpeg de la máquina.
const app = createApp({ media: nodeMedia(process.env.FFMPEG_PATH || 'ffmpeg') });
const env = localEnv();
const steam = () => '7656119' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');

type Res = { status: number; body: any };
async function req(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData } = {}): Promise<Res> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await app.request(
    path,
    { method, headers, ...(opts.form ? { body: opts.form } : opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}) },
    env,
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};

/** Archivos de prueba hechos con ffmpeg: un GIF animado de 320×240 y un PNG de 480×960 (1:2, el fondo de miniperfil). */
const dir = mkdtempSync(join(tmpdir(), 'custom-test-'));
function make(name: string, args: string[]): Uint8Array<ArrayBuffer> {
  const out = join(dir, name);
  const r = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-y', ...args, out]);
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr?.toString()}`);
  return Uint8Array.from(readFileSync(out));
}
const GIF = make('a.gif', ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10', '-t', '1']);
const PNG = make('f.png', ['-f', 'lavfi', '-i', 'color=c=red:size=480x960', '-frames:v', '1']);
const SQUARE = make('q.png', ['-f', 'lavfi', '-i', 'color=c=blue:size=600x600', '-frames:v', '1']);

function form(file: Uint8Array<ArrayBuffer>, name: string, fields: Record<string, string>) {
  const f = new FormData();
  f.append('file', new File([file], name));
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

let adminUser: { id: string; token: string };
let vip: { id: string; token: string };
let plain: { id: string; token: string };
let reporter: { id: string; token: string };
const vipPlayer = crypto.randomUUID();
const plainPlayer = crypto.randomUUID();
// Los precios de hoy (el admin los cambia): avatar y fondo animado en monedas VIP, fondo fijo en puntos.
let P = { avatar: 0, animated: 0, fixed: 0 };
// Cuántos guarda cada cuenta de cada tipo.
let MAX = { avatar: 0, background: 0 };

beforeAll(async () => {
  [adminUser, vip, plain, reporter] = await Promise.all([createUser({ role: 'admin' }), createUser(), createUser(), createUser()]);
  const db = admin();
  const cfg = check(
    await db.from('points_config')
      .select('custom_avatar_price, custom_bg_animated_price, custom_bg_static_price, custom_max_avatar, custom_max_background')
      .eq('id', 1).single(),
  ).data!;
  P = { avatar: cfg.custom_avatar_price, animated: cfg.custom_bg_animated_price, fixed: cfg.custom_bg_static_price };
  MAX = { avatar: cfg.custom_max_avatar, background: cfg.custom_max_background };
  check(await db.from('players').insert([
    { id: vipPlayer, nick: `cv${vipPlayer.slice(0, 6)}`, steam_id: steam(), user_id: vip.id },
    { id: plainPlayer, nick: `cp${plainPlayer.slice(0, 6)}`, steam_id: steam(), user_id: plain.id },
  ]));
  check(await db.from('vip_memberships').insert({ user_id: vip.id, starts_at: '2000-01-01', source: 'import' }));
  check(await db.from('point_grants').insert([
    { user_id: vip.id, currency: 'vip', amount: 5000, reason: 'prueba' },
    { user_id: vip.id, currency: 'points', amount: 5000, reason: 'prueba' },
    { user_id: plain.id, currency: 'points', amount: 5000, reason: 'prueba' },
  ]));
});

afterAll(async () => {
  const db = admin();
  const users = [vip.id, plain.id, reporter.id];
  const files = (await db.storage.from('cosmetics').list(vip.id)).data ?? [];
  const files2 = (await db.storage.from('cosmetics').list(plain.id)).data ?? [];
  const paths = [...files.map((f) => `${vip.id}/${f.name}`), ...files2.map((f) => `${plain.id}/${f.name}`)];
  if (paths.length) await db.storage.from('cosmetics').remove(paths);
  await db.from('profile_media_reports').delete().in('target', users);
  await db.from('custom_cosmetics').delete().in('user_id', users);
  await db.from('user_cosmetics').delete().in('user_id', users);
  await db.from('point_grants').delete().in('user_id', users);
  await db.from('notifications').delete().in('user_id', users);
  await db.from('vip_memberships').delete().eq('user_id', vip.id);
  await db.from('players').delete().in('id', [vipPlayer, plainPlayer]);
  rmSync(dir, { recursive: true, force: true });
});

describe('lo propio', () => {
  it('los precios, los topes y si se puede subir animado', async () => {
    const r = await req('GET', '/api/v1/me/custom', { token: plain.token });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ avatar: [], background: [], animated_available: true });
    expect(r.body.prices).toEqual({ avatar: P.avatar, background_animated: P.animated, background_static: P.fixed });
    expect(r.body.max).toEqual({ avatar: MAX.avatar, background: MAX.background });
  });

  it('sin VIP: lo animado no; el fondo de miniperfil fijo sí, con puntos y la proporción 1:2', async () => {
    let r = await req('POST', '/api/v1/me/custom/avatar', { token: plain.token, form: form(GIF, 'a.gif', { price: String(P.avatar), rights: 'true' }) });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('VIP_REQUIRED');
    r = await req('POST', '/api/v1/me/custom/background', {
      token: plain.token, form: form(SQUARE, 'q.png', { price: String(P.fixed), animated: 'false', rights: 'true' }),
    });
    expect(r.status).toBe(400);
    r = await req('POST', '/api/v1/me/custom/background', { token: plain.token, form: form(PNG, 'f.png', { price: String(P.fixed), animated: 'false' }) });
    expect(r.status).toBe(400); // sin la casilla de derechos
    r = await req('POST', '/api/v1/me/custom/background', {
      token: plain.token, form: form(PNG, 'f.png', { price: String(P.fixed), animated: 'false', rights: 'true' }),
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ price_paid: P.fixed, currency: 'points', balance: 5000 - P.fixed });
    expect(r.body.background).toHaveLength(1);
    expect(r.body.background[0]).toMatchObject({ id: r.body.id, animated: false, equipped: true, visible: true, poster_url: null });
    expect(r.body.background[0].url).toContain('/storage/v1/object/public/cosmetics/');
    const file = await fetch(r.body.background[0].url);
    expect(file.status).toBe(200);
  });

  it('VIP: el avatar animado se convierte a WebM con imagen fija, cobra en monedas VIP y se ve en la ficha', async () => {
    let r = await req('POST', '/api/v1/me/custom/avatar', { token: vip.token, form: form(GIF, 'a.gif', { price: '1', rights: 'true' }) });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe(`El precio cambió: ahora cuesta ${P.avatar}`);
    r = await req('POST', '/api/v1/me/custom/avatar', {
      token: vip.token, form: form(GIF, 'a.gif', { price: String(P.avatar), rights: 'true', crop_x: '40', crop_y: '0', crop_w: '240', crop_h: '240' }),
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ price_paid: P.avatar, currency: 'vip', balance: 5000 - P.avatar });
    const a = r.body.avatar[0];
    expect(a.url).toMatch(/\.webm$/);
    expect(a.poster_url).toMatch(/\.webp$/);
    const video = await fetch(a.url);
    expect(video.headers.get('content-type')).toBe('video/webm');
    const pub = await req('GET', `/api/v1/cosmetics?players=${vipPlayer}`);
    expect(pub.body.items[0].avatar).toMatchObject({ id: 'custom', kind: 'avatar', url: a.url, file: null });
    const eq = await req('GET', '/api/v1/me/cosmetics', { token: vip.token });
    expect(eq.body.avatar).toBe(`custom:${a.id}`);
  });

  it('subir otro cobra otra vez y deja el anterior guardado; volver a él no cobra', async () => {
    const first = (await req('GET', '/api/v1/me/custom', { token: vip.token })).body.avatar[0];
    const r = await req('POST', '/api/v1/me/custom/avatar', { token: vip.token, form: form(GIF, 'a.gif', { price: String(P.avatar), rights: 'true' }) });
    expect(r.status).toBe(200);
    expect(r.body.balance).toBe(5000 - 2 * P.avatar);
    expect(r.body.avatar.map((x: { id: string }) => x.id)).toEqual([r.body.id, first.id]);
    expect(r.body.avatar.map((x: { equipped: boolean }) => x.equipped)).toEqual([true, false]);
    await new Promise((ok) => setTimeout(ok, 1500));
    expect((await fetch(first.url)).status).toBe(200); // el archivo del anterior sigue
    const put = await req('PUT', '/api/v1/me/cosmetics', { token: vip.token, body: { avatar: `custom:${first.id}` } });
    expect(put.status).toBe(200);
    expect(put.body.avatar).toBe(`custom:${first.id}`);
    const pub = await req('GET', `/api/v1/cosmetics?players=${vipPlayer}`);
    expect(pub.body.items[0].avatar.url).toBe(first.url);
    const pts = await req('GET', '/api/v1/me/points', { token: vip.token });
    expect(pts.body.vip_coins.balance).toBe(5000 - 2 * P.avatar);
    const h = await req('GET', '/api/v1/me/points/history?currency=vip', { token: vip.token });
    expect(h.body.items.filter((x: { kind: string }) => x.kind === 'custom')).toHaveLength(2);
    // una subida ajena o mal escrita no se pone
    const other = await req('PUT', '/api/v1/me/cosmetics', { token: plain.token, body: { avatar: `custom:${first.id}` } });
    expect(other.status).toBe(400);
    const bad = await req('PUT', '/api/v1/me/cosmetics', { token: vip.token, body: { avatar: 'custom:nada' } });
    expect(bad.status).toBe(400);
  });

  it('con el tope lleno no deja subir ni cobra, antes de convertir', async () => {
    check(await admin().from('points_config').update({ custom_max_avatar: 2 }).eq('id', 1));
    try {
      const r = await req('POST', '/api/v1/me/custom/avatar', { token: vip.token, form: form(GIF, 'a.gif', { price: String(P.avatar), rights: 'true' }) });
      expect(r.status).toBe(400);
      expect(r.body.error.message).toBe('Llegaste a 2 avatares guardados: borra uno para subir otro');
      const pts = await req('GET', '/api/v1/me/points', { token: vip.token });
      expect(pts.body.vip_coins.balance).toBe(5000 - 2 * P.avatar);
    } finally {
      check(await admin().from('points_config').update({ custom_max_avatar: MAX.avatar }).eq('id', 1));
    }
  });

  it('denunciar la puesta y sacarla con aviso: las demás guardadas siguen', async () => {
    let r = await req('POST', `/api/v1/players/${vipPlayer}/media-reports`, { token: reporter.token, body: { kind: 'avatar', reason: 'copyright' } });
    expect(r.status).toBe(204);
    r = await req('POST', `/api/v1/players/${vipPlayer}/media-reports`, { token: reporter.token, body: { kind: 'avatar', reason: 'nsfw' } });
    expect(r.status).toBe(400);
    r = await req('GET', '/api/v1/admin/profile-media-reports', { token: reporter.token });
    expect(r.status).toBe(403);
    r = await req('GET', '/api/v1/admin/profile-media-reports?kind=avatar', { token: adminUser.token });
    expect(r.status).toBe(200);
    const mine = r.body.items.find((x: { profile: { id: string } | null }) => x.profile?.id === vipPlayer);
    expect(mine).toMatchObject({ reason: 'copyright', current: true, status: 'open' });
    r = await req('POST', `/api/v1/admin/profile-media-reports/${mine.id}/resolve`, { token: adminUser.token, body: { action: 'remove' } });
    expect(r.status).toBe(204);
    const me = await req('GET', '/api/v1/me/custom', { token: vip.token });
    expect(me.body.avatar).toHaveLength(1);
    expect(me.body.avatar[0]).toMatchObject({ equipped: false });
    expect(me.body.avatar[0].url).not.toBe(mine.url);
    const n = check(await admin().from('notifications').select('type').eq('user_id', vip.id).eq('type', 'custom_removed'));
    expect(n.data).toHaveLength(1);
  });

  it('el dueño borra una guardada; el admin saca otra desde Gestionar', async () => {
    let r = await req('POST', '/api/v1/me/custom/background', {
      token: plain.token, form: form(PNG, 'f.png', { price: String(P.fixed), animated: 'false', rights: 'true' }),
    });
    expect(r.status).toBe(200);
    const [nuevo, viejo] = r.body.background as { id: string; url: string }[];
    r = await req('DELETE', `/api/v1/me/custom/items/${viejo!.id}`, { token: plain.token });
    expect(r.status).toBe(200);
    expect(r.body.background.map((x: { id: string }) => x.id)).toEqual([nuevo!.id]);
    r = await req('DELETE', `/api/v1/me/custom/items/${viejo!.id}`, { token: plain.token });
    expect(r.status).toBe(404);
    r = await req('POST', `/api/v1/admin/users/${plain.id}/custom/items/${viejo!.id}/clear`, { token: adminUser.token, body: { reason: 'prueba' } });
    expect(r.status).toBe(404);
    r = await req('GET', `/api/v1/admin/users/${plain.id}/custom`, { token: adminUser.token });
    expect(r.body.background).toHaveLength(1);
    expect(r.body.background[0]).toMatchObject({ id: nuevo!.id, animated: false, equipped: true });
    r = await req('POST', `/api/v1/admin/users/${plain.id}/custom/items/${nuevo!.id}/clear`, { token: adminUser.token, body: { reason: 'prueba' } });
    expect(r.status).toBe(204);
    r = await req('GET', '/api/v1/me/custom', { token: plain.token });
    expect(r.body.background).toEqual([]);
    const eq = await req('GET', '/api/v1/me/cosmetics', { token: plain.token });
    expect(eq.body.background).toBeNull();
  });
});
