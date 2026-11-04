import { must, notFound } from '../lib/db';
import type { Db } from '../lib/supabase';

// Las rutas públicas de un jugador aceptan su id o su nick (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking).
// El nick es único sin distinguir mayúsculas ni espacios de los costados (índice players_nick_unico del replanteo 27).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El nick tal cual para un `ilike` exacto: sin comodines de LIKE. */
export const likeExact = (v: string) => v.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Id de la ficha a partir de su id o su nick. 404 si no existe. */
export async function resolvePlayer(sb: Db, ref: string): Promise<string> {
  const v = ref.trim();
  const q = sb.from('players').select('id');
  const row = must(await (UUID.test(v) ? q.eq('id', v.toLowerCase()) : q.ilike('nick', likeExact(v))).maybeSingle());
  if (!row) throw notFound('ese jugador');
  return row.id;
}
