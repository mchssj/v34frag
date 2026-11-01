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
 * Solo lee: la máquina de render sube y borra con las claves S3 (render/r2.py). La clave cambia en cada
 * grabación, así que un video nunca cambia bajo la misma dirección.
 */

const CLIP_RE = /^\/clip\/([0-9a-f-]{36}\/[0-9a-f-]{36}-[A-Za-z0-9]{4,32}\.mp4)$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(CLIP_RE);
    if (!m) return text('Not found', 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    if (request.method !== 'GET' && request.method !== 'HEAD') return text('Method not allowed', 405);
    return serve(env, `clips/${m[1]}`, request);
  },
};

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
