import {
  CATEGORIES,
  METAL_LEVEL,
  templateOf,
  type MedalLook,
  type Metal,
} from "@/features/medals/templates"

// Logros del perfil (plan docs/bitacora/2026-11-04-medallas-configurables, sección 9.3): las obtenidas por familia y,
// de cada serie, solo la próxima bloqueada con su progreso ("312 / 500 kills con AWP"). La vitrina muestra las de más
// nivel en grande (elegir cuáles destaca el jugador queda para después).

type Look = MedalLook & { id: string; key: string; title: string }
export type EarnedMedal = {
  id: string
  title: string
  created_at: string
  source: string
  season: { name: string } | null
  event?: { id: string; name: string } | null
  design: Look
}
export type Progress = {
  design: Look
  series: string | null
  series_order: number | null
  target: number
  value: number
  data_since: string | null
  earned_at: string | null
}

export type Item = {
  key: string
  look: Look
  title: string
  sub: string
  locked: boolean
  pct: number
  /** El torneo de una medalla de campeón o finalista (replanteo 114). */
  event?: { id: string; name: string } | null
}
export type Section = { title: string; items: Item[] }

const day = (iso: string) => iso.slice(0, 10)
const fmt = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString("es-AR") : String(n)
const level = (l: Look) => METAL_LEVEL[(l.metal ?? "bronce") as Metal] ?? 0

export function buildAchievements(earned: EarnedMedal[], progress: Progress[]) {
  type Row = Item & { cat: string; level: number; at: string; order: number }
  const rows: Row[] = []
  const fromProgress = new Set(progress.map((p) => p.design.id))

  // Del motor: las ganadas y la próxima de cada serie.
  const series = new Map<string, Progress[]>()
  for (const p of progress) {
    const k = p.series ?? p.design.id
    series.set(k, [...(series.get(k) ?? []), p])
  }
  for (const list of series.values()) {
    list.sort(
      (a, b) =>
        (a.series_order ?? 0) - (b.series_order ?? 0) || a.target - b.target
    )
    const next = list.find((p) => p.earned_at === null)
    for (const p of list) {
      if (p.earned_at === null && p !== next) continue
      const locked = p.earned_at === null
      rows.push({
        key: p.design.id,
        look: p.design,
        title: p.design.title,
        sub: locked
          ? `${fmt(p.value)} / ${fmt(p.target)}`
          : `Obtenida el ${day(p.earned_at!)}`,
        locked,
        pct: locked
          ? Math.min(
              99,
              Math.floor((p.value / Math.max(p.target, 0.0001)) * 100)
            )
          : 100,
        cat: templateOf(p.design.template)?.category ?? "Comunidad",
        level: level(p.design),
        at: p.earned_at ?? "",
        order: p.series_order ?? 0,
      })
    }
  }

  // De temporada, a mano o de medallas que ya no están activas.
  for (const m of earned) {
    if (m.source === "auto" && fromProgress.has(m.design.id)) continue
    rows.push({
      key: m.id,
      look: m.design,
      title: m.season ? m.design.title : m.title,
      sub: m.season ? m.season.name : `Obtenida el ${day(m.created_at)}`,
      event: m.event ?? null,
      locked: false,
      pct: 100,
      cat: templateOf(m.design.template)?.category ?? "Comunidad",
      // En la vitrina, las de temporada van primero.
      level: level(m.design) + (m.season ? 5 : 0),
      at: m.created_at,
      order: 0,
    })
  }

  const got = rows.filter((r) => !r.locked)
  const pending = progress.filter((p) => p.earned_at === null).length
  const showcase = [...got]
    .sort((a, b) => b.level - a.level || b.at.localeCompare(a.at))
    .slice(0, 4)
  const closest =
    rows.filter((r) => r.locked).sort((a, b) => b.pct - a.pct)[0] ?? null
  const sections: Section[] = CATEGORIES.map((cat) => ({
    title: cat,
    items: rows
      .filter((r) => r.cat === cat)
      .sort(
        (a, b) =>
          a.look.template.localeCompare(b.look.template) ||
          Number(a.locked) - Number(b.locked) ||
          a.order - b.order ||
          a.at.localeCompare(b.at)
      ),
  })).filter((s) => s.items.length > 0)

  return { showcase, sections, got: got.length, pending, closest }
}
