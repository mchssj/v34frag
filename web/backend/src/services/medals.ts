import type { z } from '@hono/zod-openapi';
import manifest from '../../../frontend/src/features/medals/templates.json';
import { mustHave } from '../lib/db';
import { AppError } from '../lib/errors';
import type { Db } from '../lib/supabase';
import type { MedalDesign } from '../schemas/medals';

// Medallas configurables (replanteo 79, plan docs/bitacora/2026-11-04-medallas-configurables). El manifiesto de
// plantillas es el mismo archivo que usa la web (pregunta 2 del plan): de ahí salen la métrica, la agregación, los
// filtros y qué deja editar cada plantilla. designOf hace lo mismo que medal_design de la base (la de los avisos).

export type Template = (typeof manifest.plantillas)[number];
export const TEMPLATES: Template[] = manifest.plantillas;
export const ACCENTS = Object.keys(manifest.acentos).filter((k) => k !== 'bloqueada');
export const METALS = ['bronce', 'plata', 'oro', 'platino', 'diamante'] as const;
export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id);

export const DEF_FIELDS =
  'id, key, template, scope, title, description, design, metric, aggregation, filters, target, series, series_order, status, retroactive, data_since, activated_at, created_at';

export type DesignJson = { number?: string | null; label?: string | null; band?: string | null; metal?: string | null; accent?: string | null };
export type DefRow = {
  id: string; key: string; template: string; scope: string; title: string; description: string | null; design: DesignJson;
  metric: string; aggregation: string; filters: Record<string, unknown>; target: number; series: string | null;
  series_order: number | null; status: string; retroactive: boolean; data_since: string | null; activated_at: string | null; created_at: string;
};
type Design = z.infer<typeof MedalDesign>;

/** El dibujo de una medalla. Las de temporada llevan el puesto (podio) y la etiqueta `S<número>`. */
export function designOf(d: DefRow, rank?: number | null, season?: number | null): Design {
  const seasonal = d.aggregation === 'season_rank';
  const g = d.design ?? {};
  return {
    id: d.id,
    key: d.key,
    template: d.template,
    title: d.title,
    number: d.template === 'podio' && rank ? String(rank) : (g.number ?? null),
    label: seasonal ? `S${season ?? ''}` : (g.label ?? null),
    band: g.band ?? null,
    metal: (g.metal ?? null) as Design['metal'],
    accent: g.accent ?? null,
  };
}

/** Las definiciones por id (las que el usuario puede ver: sin los borradores, salvo un admin). */
export async function loadDefinitions(sb: Db, ids: (string | null | undefined)[]): Promise<Map<string, DefRow>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return new Map();
  const rows = mustHave(await sb.from('medal_definitions').select(DEF_FIELDS).in('id', want)) as unknown as DefRow[];
  return new Map(rows.map((r) => [r.id, r]));
}

/** Las definiciones por clave (las de los tramos de temporada). */
export async function loadDefinitionsByKey(sb: Db, keys: (string | null | undefined)[]): Promise<Map<string, DefRow>> {
  const want = [...new Set(keys.filter((x): x is string => !!x))];
  if (!want.length) return new Map();
  const rows = mustHave(await sb.from('medal_definitions').select(DEF_FIELDS).in('key', want)) as unknown as DefRow[];
  return new Map(rows.map((r) => [r.key, r]));
}

export type TierLike = { from: number; to?: number | null; definition?: string | null };

/** La definición (clave) del tramo de un puesto, como season_tier_definition. */
export function tierDefinition(tiers: TierLike[], rank: number | null, topN: number): string | null {
  if (rank === null || rank > topN) return null;
  const t = tiers.find((x) => rank >= x.from && rank <= (x.to ?? topN));
  return t?.definition ?? null;
}

const bad = (m: string) => new AppError(400, 'VALIDATION_ERROR', m);

/**
 * Valida el diseño contra lo que la plantilla deja editar y completa lo demás con sus valores por defecto. Lo que la
 * plantilla no deja cambiar se descarta.
 */
export function normalizeDesign(t: Template, d: DesignJson, current: DesignJson = {}): DesignJson {
  const out: DesignJson = {};
  const pick = <K extends keyof DesignJson>(k: K, editable: boolean, fallback: string | null) => {
    const v = d[k] !== undefined ? d[k] : current[k];
    out[k] = editable && v !== undefined && v !== null ? String(v).trim() : (fallback ?? undefined);
  };
  pick('number', t.editable.number, null);
  pick('label', t.editable.label, null);
  pick('band', t.editable.band, null);
  pick('accent', t.editable.accent, t.accent);
  out.metal = d.metal ?? current.metal ?? t.metal ?? 'oro';
  if (!METALS.includes(out.metal as (typeof METALS)[number])) throw bad('El metal tiene que ser bronce, plata, oro, platino o diamante.');
  if (out.accent && !ACCENTS.includes(out.accent)) throw bad('Ese color no está en la paleta de medallas.');
  if ((out.number ?? '').length > 5) throw bad('El número: hasta 5 caracteres.');
  if ((out.label ?? '').length > 14) throw bad('La etiqueta: hasta 14 caracteres.');
  if ((out.band ?? '').length > 14) throw bad('La banda: hasta 14 caracteres.');
  for (const k of Object.keys(out) as (keyof DesignJson)[]) if (out[k] === undefined || out[k] === '') delete out[k];
  if (out.label) out.label = out.label.toUpperCase();
  if (out.band) out.band = out.band.toUpperCase();
  return out;
}

/** Título por defecto: el formato de la plantilla con el objetivo ("{n} kills con AWP" → "500 kills con AWP"). */
export function defaultTitle(t: Template, target: number) {
  const n = Number.isInteger(target) && target >= 10000 ? target.toLocaleString('es-AR') : String(target);
  return t.titleFmt.replace('{n}', n);
}

/** Clave estable: la plantilla y el objetivo (hs_pct_45, kda_1_5). */
export const defaultKey = (t: Template, target: number) =>
  t.aggregation === 'manual' || t.aggregation === 'once' ? t.id : `${t.id}_${String(target).replace('.', '_')}`;
