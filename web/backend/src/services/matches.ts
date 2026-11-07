import type { z } from '@hono/zod-openapi';
import type { Config } from '../env';
import type { MatchSummary, MixReview, VetoState } from '../schemas/matches';
import { fromPostgrest } from '../lib/errors';
import type { Db } from '../lib/supabase';
import { stageLabel, type StageInfo } from './stages';

// Columnas de la vista match_list (replanteo 11) que arman un MatchSummary.
export const MATCH_LIST =
  'id, kind, status, event_id, event_name, stage, phase, grp, round, pos, bye, best_of, map, starts_at, played_at, score1, score2, winner_side, ' +
  'side1_name, side2_name, team1_id, team1_name, team1_tag, team2_id, team2_name, team2_tag, end_reason, demo_status, parent_match_id, last_round, ' +
  'cancel_reason, review, review_max_rounds, team1_logo_url, team2_logo_url';

export type MatchRow = StageInfo & {
  id: string; kind: string; status: string; event_id: string | null; event_name: string | null; pos: number | null; bye: boolean;
  best_of: number; map: string | null; starts_at: string | null; played_at: string | null; score1: number | null; score2: number | null;
  winner_side: number | null; side1_name: string | null; side2_name: string | null; team1_id: string | null; team1_name: string | null;
  team1_tag: string | null; team2_id: string | null; team2_name: string | null; team2_tag: string | null; end_reason: string | null;
  demo_status: string; parent_match_id: string | null; last_round: number | null;
  cancel_reason: string | null; review: string | null; review_max_rounds: number | null;
  team1_logo_url: string | null; team2_logo_url: string | null;
};

const team = (id: string | null, name: string | null, tag: string | null, logo_url: string | null) =>
  id ? { id, name: name ?? '', tag, logo_url } : null;

export function toSummary(m: MatchRow): z.infer<typeof MatchSummary> {
  const last = new Map<string, number>();
  if (m.stage && m.last_round !== null) last.set(`${m.stage}:${m.phase ?? 1}`, m.last_round);
  return {
    id: m.id,
    kind: m.kind as 'mix' | 'pcw' | 'official',
    status: m.status as 'upcoming' | 'live' | 'finished' | 'cancelled',
    label: m.event_id ? stageLabel(m, last) : null,
    event: m.event_id ? { id: m.event_id, name: m.event_name ?? '' } : null,
    side1: { name: m.team1_name ?? m.side1_name, team: team(m.team1_id, m.team1_name, m.team1_tag, m.team1_logo_url), score: m.score1 },
    side2: { name: m.team2_name ?? m.side2_name, team: team(m.team2_id, m.team2_name, m.team2_tag, m.team2_logo_url), score: m.score2 },
    winner_side: m.winner_side,
    best_of: m.best_of,
    map: m.map,
    starts_at: m.starts_at,
    played_at: m.played_at,
    end_reason: m.end_reason,
    cancel_reason: m.cancel_reason,
    review: m.review as 'pending' | 'applied' | 'discarded' | null,
    demo_status: m.demo_status,
    parent_match_id: m.parent_match_id,
  };
}

/** Rondas mínimas para aprobar el ELO de un mix interrumpido: 35 % de las del mix, hacia arriba (crash_min_rounds en la base). */
export const crashMinRounds = (maxRounds: number) => Math.ceil((Math.max(maxRounds, 1) * 35) / 100);

/** Revisión de un mix interrumpido, con lo que el admin necesita para decidir. null si no es un interrumpido. */
export function mixReview(m: Pick<MatchRow, 'review' | 'review_max_rounds' | 'score1' | 'score2'>): z.infer<typeof MixReview> | null {
  if (!m.review || m.review_max_rounds === null) return null;
  const s1 = m.score1 ?? 0;
  const s2 = m.score2 ?? 0;
  const played = s1 + s2;
  const min = crashMinRounds(m.review_max_rounds);
  const pending = m.review === 'pending';
  const blocked = !pending ? null : played < min ? `Se jugaron ${played} de ${m.review_max_rounds} rondas: hacen falta ${min} (35 %).` : s1 === s2 ? 'Iban empatados: no hay ganador para el ELO.' : null;
  return {
    status: m.review as 'pending' | 'applied' | 'discarded',
    max_rounds: m.review_max_rounds,
    rounds_played: played,
    min_rounds: min,
    can_apply: pending && blocked === null,
    blocked_reason: blocked,
  };
}

export const demoUrl = (cfg: Config, m: { kind: string; external_id: string | null; demo_status: string }) =>
  m.kind === 'mix' && m.external_id && m.demo_status === 'uploaded' && cfg.DEMO_BASE_URL
    ? `${cfg.DEMO_BASE_URL}/demo/${encodeURIComponent(m.external_id)}`
    : null;

/** Secuencia del veto, igual que veto_sequence() en la base. */
export function vetoSequence(bo: number, maps: number): ('ban' | 'pick')[] {
  const a: ('ban' | 'pick')[] = [];
  if (bo >= 3) a.push('ban', 'ban');
  if (bo === 3) a.push('pick', 'pick');
  if (bo >= 5) a.push('pick', 'pick', 'pick', 'pick');
  while (a.length < maps - 1) a.push('ban');
  return a.slice(0, Math.max(0, maps - 1));
}

type VetoRow = { seq: number; team_id: string | null; map: string; action: string; version: string | null };

/** Estado del veto: próximo turno y, al terminar, los mapas a jugar con su versión. */
export function vetoState(
  pool: { name: string; versions: string[] }[],
  rows: VetoRow[],
  bo: number,
  team1: string | null,
  team2: string | null,
  deciderVersions: Record<string, string>,
): z.infer<typeof VetoState> {
  const actions = [...rows].sort((a, b) => a.seq - b.seq).map((r) => ({ ...r, action: r.action as 'ban' | 'pick' }));
  const sequence = vetoSequence(bo, pool.length);
  const n = actions.length;
  const done = n >= sequence.length;
  const used = new Set(actions.map((a) => a.map));
  const rest = pool.filter((p) => !used.has(p.name));
  const maps_to_play = done
    ? [
        ...actions.filter((a) => a.action === 'pick').map((a) => ({ map: a.map, version: a.version ?? a.map, decider: false })),
        ...rest.slice(0, 1).map((p) => ({ map: p.name, version: deciderVersions[p.name] ?? p.versions[0] ?? p.name, decider: true })),
      ]
    : [];
  return {
    pool,
    actions,
    sequence,
    next: done ? null : { team_id: n % 2 === 0 ? team1 : team2, action: sequence[n]! },
    maps_to_play,
  };
}

/** Clutches ganados por cantidad de rivales, con las cinco claves aunque falten (replanteo 29). */
export function clutchesOf(rows: { vs: number | null; won: number | null }[]) {
  const out = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  for (const r of rows) {
    const k = String(r.vs) as keyof typeof out;
    if (k in out) out[k] += r.won ?? 0;
  }
  return out;
}

const SUMMED = ['kills', 'deaths', 'assists', 'headshots', 'damage', 'rounds', 'k2', 'k3', 'k4', 'k5', 'first_kills', 'first_deaths', 'plants', 'defuses'] as const;

/** Fila de `match_player_stats` con la que se arma un `PlayerLine`. */
export type StatRow = {
  player_id: string | null; steam_id: string; nick: string | null; team: number; rating: number | null; elo_delta: number | null;
} & Record<(typeof SUMMED)[number], number | null>;

/**
 * Stats de una serie (E21): suma por jugador los juegos vinculados, con el lado de la serie
 * (`flipped` dice qué juegos tienen los bandos invertidos, `parent_side1 = 2`) y el rating
 * ponderado por rondas. Cada juego es un mix con su ELO: `elo_delta` es la suma (null si ningún juego lo movió).
 */
export function sumSeries(
  rows: (Omit<StatRow, 'elo_delta'> & { elo_delta?: number | null; match_id: string | null })[],
  flipped: Map<string, boolean>,
): StatRow[] {
  const acc = new Map<string, { line: StatRow; weighted: number; rated: number }>();
  for (const r of rows) {
    const side = r.match_id && flipped.get(r.match_id) ? 3 - r.team : r.team;
    const key = `${r.player_id ?? r.steam_id}:${side}`;
    let a = acc.get(key);
    if (!a) {
      const zeros = Object.fromEntries(SUMMED.map((k) => [k, 0])) as Record<(typeof SUMMED)[number], number>;
      a = { line: { player_id: r.player_id, steam_id: r.steam_id, nick: r.nick, team: side, rating: null, elo_delta: null, ...zeros }, weighted: 0, rated: 0 };
      acc.set(key, a);
    }
    for (const k of SUMMED) a.line[k] = (a.line[k] ?? 0) + (r[k] ?? 0);
    if (r.elo_delta != null) a.line.elo_delta = (a.line.elo_delta ?? 0) + r.elo_delta;
    if (r.rating !== null && (r.rounds ?? 0) > 0) {
      a.weighted += r.rating * (r.rounds ?? 0);
      a.rated += r.rounds ?? 0;
    }
    a.line.nick = r.nick ?? a.line.nick;
  }
  return [...acc.values()].map(({ line, weighted, rated }) => ({ ...line, rating: rated ? Math.round((weighted / rated) * 100) / 100 : null }));
}

type TeamLike = { id: string; historic?: boolean } | null;
type WithSides = { side1: { team: TeamLike }; side2: { team: TeamLike } };

/** Ids de los equipos históricos (replanteo 80: no están en la plataforma y no tienen página) entre los dados. */
export async function historicTeams(sb: Db, ids: (string | null | undefined)[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Set();
  const { data, error } = await sb.from('teams').select('id').eq('kind', 'historic').in('id', unique);
  if (error) throw fromPostgrest(error);
  return new Set((data ?? []).map((t) => t.id));
}

/** Marca `historic: true` en los equipos históricos de los lados de cada partida. */
export async function markHistoricSides<T extends WithSides>(sb: Db, rows: T[]): Promise<T[]> {
  const hist = await historicTeams(sb, rows.flatMap((r) => [r.side1.team?.id, r.side2.team?.id]));
  if (!hist.size) return rows;
  for (const r of rows) for (const t of [r.side1.team, r.side2.team]) if (t && hist.has(t.id)) t.historic = true;
  return rows;
}
