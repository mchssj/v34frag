import type { Context } from 'hono';
import type { AppEnv } from './types';

/**
 * ETag débil a partir del cuerpo que se va a mandar. Si el cliente manda el mismo en If-None-Match,
 * devuelve true (la ruta responde 304 sin cuerpo). Sirve para consultar el detalle cada pocos segundos.
 */
export async function notModified(c: Context<AppEnv>, body: unknown): Promise<boolean> {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes));
  const tag = `W/"${Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('')}"`;
  c.header('ETag', tag);
  c.header('Cache-Control', 'no-cache');
  const sent = c.req.header('If-None-Match');
  return !!sent && sent.split(',').some((t) => t.trim() === tag);
}
