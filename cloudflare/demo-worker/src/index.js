/**
 * Worker de demos de v34frag (ver docs/bitacora/2026-10-12-demos-r2-worker).
 *
 * Cron cada 10 minutos: pide a Supabase las partidas con la demo pendiente (demo_pending), baja cada
 * demo del servidor por la API de Pterodactyl y la sube a R2 en stream (sin cargarla en memoria).
 * Marca el resultado con demo_mark y, si DELETE_AFTER_UPLOAD = "true", borra la demo del servidor.
 * Cron diario: demo_expire marca como vencidas las que pasaron RETENTION_DAYS (R2 las borra con su regla).
 *
 * Rutas:
 *   GET /demo/<match_uid>      descarga pública, con un nombre legible
 *   GET /run?key=<ADMIN_KEY>   corre el cron a mano (para probar) y devuelve lo que hizo
 */

const UID_RE = /^[A-Za-z0-9_-]{6,80}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const demo = url.pathname.match(/^\/demo\/([A-Za-z0-9_-]{6,80})(?:\.dem)?$/);
    if (demo && (request.method === 'GET' || request.method === 'HEAD')) return download(env, demo[1], request.method);
    if (url.pathname === '/run') {
      if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return text('Forbidden', 403);
      return json(await uploadPending(env));
    }
    return text('Not found', 404);
  },

  async scheduled(event, env, ctx) {
    if (event.cron === env.EXPIRE_CRON) {
      ctx.waitUntil(supabase(env, 'demo_expire', { p_days: Number(env.RETENTION_DAYS) || 90 })
        .then((n) => console.log(`demo_expire: ${n} vencidas`)));
    } else {
      ctx.waitUntil(uploadPending(env).then((r) => console.log(JSON.stringify(r))));
    }
  },
};

// ---------------------------------------------------------------------------------------------
// Subida
// ---------------------------------------------------------------------------------------------

async function uploadPending(env) {
  const out = { pending: 0, results: [] };
  const pending = await supabase(env, 'demo_pending', { p_limit: 10 });
  out.pending = pending.length;
  if (!pending.length) return out;

  // Un listado por servidor del panel (normalmente uno solo).
  const listings = new Map();
  for (const m of pending) {
    const r = { uid: m.external_id };
    out.results.push(r);
    try {
      if (!UID_RE.test(m.external_id)) throw new Error('uid inválido');
      if (!listings.has(m.panel_server_id)) listings.set(m.panel_server_id, await listDemos(env, m.panel_server_id));
      const file = listings.get(m.panel_server_id).get(`${m.external_id}.dem`);
      if (!file) {
        r.status = await supabase(env, 'demo_mark', { p_uid: m.external_id, p_result: 'retry' });
        r.note = 'la demo no está en el servidor';
        continue;
      }
      const key = r2Key(m);
      const size = await copyToR2(env, m.panel_server_id, file, key);
      r.status = await supabase(env, 'demo_mark', { p_uid: m.external_id, p_result: 'uploaded', p_key: key, p_size: size });
      r.key = key;
      r.size = size;
      if (env.DELETE_AFTER_UPLOAD === 'true') {
        await ptero(env, m.panel_server_id, '/files/delete', { root: env.DEMO_DIR, files: [file.name] });
        r.deleted = true;
      }
    } catch (e) {
      r.error = String(e && e.message ? e.message : e);
      try {
        r.status = await supabase(env, 'demo_mark', { p_uid: m.external_id, p_result: 'retry' });
      } catch (e2) {
        r.mark_error = String(e2 && e2.message ? e2.message : e2);
      }
    }
  }
  return out;
}

/** Demos del servidor: Map nombre -> { name, size }. */
async function listDemos(env, server) {
  const list = await ptero(env, server, `/files/list?directory=${encodeURIComponent(env.DEMO_DIR)}`);
  const map = new Map();
  for (const { attributes: f } of list.data) if (f.is_file && f.name.endsWith('.dem')) map.set(f.name, { name: f.name, size: f.size });
  return map;
}

/** Baja la demo del nodo y la sube a R2 en stream. Devuelve el tamaño subido; falla si no coincide. */
async function copyToR2(env, server, file, key) {
  const dl = await ptero(env, server, `/files/download?file=${encodeURIComponent(`${env.DEMO_DIR}/${file.name}`)}`);
  const resp = await fetch(dl.attributes.url, { headers: { 'User-Agent': 'v34frag-demos' } });
  if (!resp.ok || !resp.body) throw new Error(`el nodo respondió ${resp.status}`);
  const len = Number(resp.headers.get('content-length'));
  if (!(len > 0)) throw new Error('el nodo no informó el tamaño');
  if (len !== file.size) throw new Error(`tamaño distinto: listado ${file.size}, descarga ${len} (¿se está grabando?)`);

  // R2 necesita el largo del stream; FixedLengthStream además falla si llegan bytes de más o de menos.
  const fixed = new FixedLengthStream(len);
  const pipe = resp.body.pipeTo(fixed.writable);
  const obj = await env.DEMOS.put(key, fixed.readable, {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: { source: file.name },
  });
  await pipe;
  if (obj.size !== file.size) {
    await env.DEMOS.delete(key);
    throw new Error(`R2 guardó ${obj.size} bytes de ${file.size}`);
  }
  return obj.size;
}

/** demos/AAAA/MM/<uid>.dem, con la fecha de la partida. */
function r2Key(m) {
  const d = new Date(m.played_at || Date.now());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `demos/${d.getUTCFullYear()}/${mm}/${m.external_id}.dem`;
}

// ---------------------------------------------------------------------------------------------
// Descarga pública
// ---------------------------------------------------------------------------------------------

async function download(env, uid, method) {
  const q = `matches?select=demo_key,demo_status,map,score1,score2,status,played_at&external_id=eq.${encodeURIComponent(uid)}`;
  const rows = await rest(env, q);
  const m = rows[0];
  if (!m) return text('Esa partida no existe.', 404);
  if (m.demo_status === 'expired') return text('La demo de esta partida ya venció.', 410);
  if (m.demo_status !== 'uploaded' || !m.demo_key) return text('La demo de esta partida todavía no está disponible.', 404);

  const obj = method === 'HEAD' ? await env.DEMOS.head(m.demo_key) : await env.DEMOS.get(m.demo_key);
  if (!obj) return text('No se encontró el archivo de la demo.', 404);
  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(obj.size),
    'Content-Disposition': `attachment; filename="${friendlyName(m)}"`,
    'Cache-Control': 'public, max-age=86400',
    ETag: obj.httpEtag,
  });
  return new Response(method === 'HEAD' ? null : obj.body, { headers });
}

/** v34frag_2026-10-12_dust2_16-12.dem (las canceladas terminan en _cancelada). */
function friendlyName(m) {
  const d = new Date(m.played_at || Date.now());
  const date = d.toISOString().slice(0, 10);
  const map = String(m.map || 'mapa').replace(/[^A-Za-z0-9_-]+/g, '') || 'mapa';
  const score = m.score1 != null && m.score2 != null ? `_${m.score1}-${m.score2}` : '';
  const cancelled = m.status === 'cancelled' ? '_cancelada' : '';
  return `v34frag_${date}_${map}${score}${cancelled}.dem`;
}

// ---------------------------------------------------------------------------------------------
// APIs
// ---------------------------------------------------------------------------------------------

async function ptero(env, server, path, body) {
  const resp = await fetch(`${env.PTERO_PANEL_URL}/api/client/servers/${server}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${env.PTERO_PANEL_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'v34frag-demos',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`Pterodactyl ${path.split('?')[0]}: HTTP ${resp.status}`);
  return resp.status === 204 ? null : resp.json();
}

/** Llama a una función del Worker en Supabase (todas reciben el token del Worker). */
async function supabase(env, fn, args) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: supabaseHeaders(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_token: env.DEMO_WORKER_TOKEN, ...args }),
  });
  if (!resp.ok) throw new Error(`Supabase ${fn}: HTTP ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

/** Lectura pública (las mismas tablas que lee la web). */
async function rest(env, query) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/${query}`, { headers: supabaseHeaders(env) });
  if (!resp.ok) throw new Error(`Supabase: HTTP ${resp.status}`);
  return resp.json();
}

function supabaseHeaders(env, extra = {}) {
  return { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, ...extra };
}

function json(data) {
  return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function text(body, status) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
