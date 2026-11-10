/**
 * Worker de clips de CMLeague (ver docs/bitacora/2026-10-23-clips-render-automatico).
 *
 * Sirve los videos de las jugadas desde el bucket de clips de R2 (cuenta de Daniel) mientras están ahí: los
 * primeros 15 días. Después el video queda solo en Google Drive y esta ruta da 404.
 *
 * Rutas:
 *   GET|HEAD /clip/<partida>/<jugada>-<sufijo>.mp4   el objeto clips/<partida>/<jugada>-<sufijo>.mp4, con Range
 *                                                    (el reproductor salta dentro del video) y caché larga
 *
 *   GET /trim?key=<ADMIN_KEY>[&dry=1]                corre el recorte a mano; con dry=1 solo dice qué borraría
 *
 * La máquina de render sube y borra con las claves S3 (render/r2.py). La clave cambia en cada grabación, así que un
 * video nunca cambia bajo la misma dirección.
 *
 * Cron de recorte (dos veces por día): si el bucket pasa de R2_MAX_BYTES, borra de R2 los clips que ya están en Drive
 * (primero los que no son destacados, el más viejo primero) hasta quedar en R2_TARGET_BYTES, y los marca con
 * clip_r2_evicted. Los que no están en Drive no se tocan (ver docs/bitacora/2026-11-10-r2-tope-10gb).
 */

const CLIP_RE = /^\/clip\/([0-9a-f-]{36}\/[0-9a-f-]{36}-[A-Za-z0-9]{4,32}\.mp4)$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/trim') {
      if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return text('Forbidden', 403);
      return json(await trimBucket(env, url.searchParams.get('dry') === '1'));
    }
    const m = url.pathname.match(CLIP_RE);
    if (!m) return text('Not found', 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    if (request.method !== 'GET' && request.method !== 'HEAD') return text('Method not allowed', 405);
    return serve(env, `clips/${m[1]}`, request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(trimBucket(env, false).then((r) => console.log(JSON.stringify(r))));
  },
};

// ---------------------------------------------------------------------------------------------
// Recorte: el bucket no pasa de R2_MAX_BYTES
// ---------------------------------------------------------------------------------------------

async function trimBucket(env, dry) {
  const max = Number(env.R2_MAX_BYTES) || 10e9;
  const target = Number(env.R2_TARGET_BYTES) || 9.5e9;
  const sizes = new Map();
  let total = 0;
  let cursor;
  do {
    const page = await env.CLIPS.list({ cursor, limit: 1000 });
    for (const o of page.objects) {
      sizes.set(o.key, o.size);
      total += o.size;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const out = { total, max, target, objects: sizes.size, deleted: 0, freed: 0, after: total, dry };
  if (total <= max) return out;

  // Ya vienen en orden (no destacados primero, el más viejo primero) y todos tienen copia en Drive.
  const due = await supabase(env, 'clip_r2_evict_due', { p_limit: 1000 });
  const picked = pickInOrder(due.map((c) => ({ ...c, size: sizes.get(c.video_key) ?? 0 })), total, target);
  out.freed = picked.reduce((n, c) => n + c.size, 0);
  out.after = total - out.freed;
  out.keys = picked.map((c) => c.video_key);
  if (out.after > target) out.note = 'no alcanza con los clips que están en Drive para bajar al objetivo';
  if (dry || !picked.length) return out;

  // Primero R2 y después la base: si la marca falla, la próxima vuelta los vuelve a dar y el borrado no hace nada.
  for (let i = 0; i < out.keys.length; i += 1000) await env.CLIPS.delete(out.keys.slice(i, i + 1000));
  out.deleted = picked.length;
  out.marked = await supabase(env, 'clip_r2_evicted', { p_clips: picked.map((c) => c.clip_id) });
  delete out.keys;
  return out;
}

/**
 * Los candidatos, en el orden en que vienen, hasta que total quede en target o menos. Uno que ya no está en R2
 * (tamaño 0) entra igual, para que la base deje de darlo.
 */
export function pickInOrder(candidates, total, target) {
  const picked = [];
  let left = total;
  for (const c of candidates) {
    if (left <= target) break;
    picked.push(c);
    left -= c.size;
  }
  return picked;
}

/** Llama a una función de los clips en Supabase con el token de render del Worker. */
async function supabase(env, fn, args) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: env.RENDER_TOKEN, ...args }),
  });
  if (!resp.ok) throw new Error(`Supabase ${fn}: HTTP ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  return resp.json();
}

function json(data) {
  return new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

async function serve(env, key, request) {
  if (request.method === 'HEAD') {
    const obj = await env.CLIPS.head(key);
    if (!obj) return text('Ese video no existe o ya no está en R2.', 404);
    return new Response(null, { headers: baseHeaders(obj, obj.size) });
  }

  // El tramo se calcula acá y se le pide exacto a R2: así Content-Range no depende de lo que devuelva obj.range.
  const range = parseRange(request.headers.get('Range'));
  if (range === false) return text('Range inválido', 416);
  let obj;
  try {
    obj = await env.CLIPS.get(key, { range: range || undefined, onlyIf: request.headers });
  } catch {
    return text('Range fuera del video', 416);
  }
  if (!obj) return text('Ese video no existe o ya no está en R2.', 404);
  // Sin cuerpo: no se cumplió una condición (If-None-Match, If-Modified-Since…).
  if (!('body' in obj)) return new Response(null, { status: 304, headers: baseHeaders(obj) });
  if (!range) return new Response(obj.body, { headers: baseHeaders(obj, obj.size) });

  let offset;
  let length;
  if ('suffix' in range) {
    length = Math.min(range.suffix, obj.size);
    offset = obj.size - length;
  } else {
    offset = range.offset;
    length = Math.min(range.length ?? obj.size - offset, obj.size - offset);
  }
  if (offset >= obj.size || length <= 0) {
    const headers = baseHeaders(obj);
    headers.set('Content-Range', `bytes */${obj.size}`);
    return new Response('Range fuera del video', { status: 416, headers });
  }
  const headers = baseHeaders(obj, length);
  headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
  return new Response(obj.body, { status: 206, headers });
}

/**
 * "bytes=a-b", "bytes=a-" o "bytes=-n" como el rango de R2 ({ offset, length } o { suffix }).
 * null sin cabecera; false si no se entiende (varios tramos tampoco: los reproductores piden uno).
 */
function parseRange(header) {
  if (!header) return null;
  const m = header.trim().match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === '' && m[2] === '')) return false;
  if (m[1] === '') return Number(m[2]) > 0 ? { suffix: Number(m[2]) } : false;
  const offset = Number(m[1]);
  if (m[2] === '') return { offset };
  const end = Number(m[2]);
  return end >= offset ? { offset, length: end - offset + 1 } : false;
}

function baseHeaders(obj, length) {
  const headers = new Headers(cors());
  headers.set('Content-Type', 'video/mp4');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', obj.httpEtag);
  if (length !== undefined) headers.set('Content-Length', String(length));
  return headers;
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
  };
}

function text(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors() } });
}
