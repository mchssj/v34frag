import type { z } from '@hono/zod-openapi';
import { mustHave } from '../lib/db';
import type { Db } from '../lib/supabase';
import type { Cosmetic, CosmeticsFull, CosmeticsLight } from '../schemas/shop';

// Tienda (replanteo 113): lo equipado de cada ficha, desde player_cosmetics_public (pública, ya sin lo que la cuenta
// no puede usar hoy). Cada artículo viene resuelto por cosmetic_json().

type C = z.infer<typeof Cosmetic>;
type Full = z.infer<typeof CosmeticsFull>;
export type Light = z.infer<typeof CosmeticsLight>;

export type CosmeticsRow = {
  player_id: string | null; vip: boolean | null;
  frame: unknown; avatar: unknown; background: unknown; theme: unknown; name: unknown; stickers: unknown;
};
export const COSMETICS_FIELDS = 'player_id, vip, frame, avatar, background, theme, name, stickers';

const one = (v: unknown): C | null => (v && typeof v === 'object' ? (v as C) : null);
export const toFull = (r: CosmeticsRow): Full => ({
  frame: one(r.frame),
  avatar: one(r.avatar),
  name: one(r.name),
  background: one(r.background),
  theme: one(r.theme),
  stickers: Array.isArray(r.stickers) ? (r.stickers as C[]) : [],
});
export const toLight = (r: CosmeticsRow): Light => ({ frame: one(r.frame), avatar: one(r.avatar), name: one(r.name) });

/** Lo equipado de cada ficha. Las que no tienen nada equipado no están en el mapa. */
export async function cosmeticsRows(sb: Db, players: string[]): Promise<Map<string, CosmeticsRow>> {
  const ids = [...new Set(players.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = mustHave(await sb.from('player_cosmetics_public').select(COSMETICS_FIELDS).in('player_id', ids)) as CosmeticsRow[];
  return new Map(rows.map((r) => [r.player_id!, r]));
}

/** El marco, el avatar y el efecto de nombre de cada ficha, para los listados. Las fichas sin ninguno no están. */
export async function cosmeticsLight(sb: Db, players: string[]): Promise<Map<string, Light>> {
  const rows = await cosmeticsRows(sb, players);
  const out = new Map<string, Light>();
  for (const [id, r] of rows) {
    const l = toLight(r);
    if (l.frame || l.avatar || l.name) out.set(id, l);
  }
  return out;
}

/** Un cosmético de una fila de shop_items o shop_catalog. */
export const cosmeticOf = (r: {
  id: string | null; kind: string | null; name: string | null; file: string | null; css_class: string | null;
  animated: boolean | null; vip_only: boolean | null;
}): C => ({
  id: r.id!,
  kind: r.kind as C['kind'],
  name: r.name ?? '',
  file: r.file,
  css_class: r.css_class,
  animated: !!r.animated,
  vip_only: !!r.vip_only,
});
