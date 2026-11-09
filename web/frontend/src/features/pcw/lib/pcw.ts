import type {
  BestOf,
  PcwFilters,
  PcwPlayer,
  PcwPost,
  PcwResult,
  PcwSide,
  TimeFilter,
} from "../types"

// Reglas de la página de PCW. Las de publicar y aceptar son las de la base (contrato partidas.md):
// 4 jugadores con cuenta, roster de 1 a 7 entre cuentas e invitados.

export const MIN_ACCOUNTS = 4
export const MAX_ROSTER = 7
/** Diferencia de ELO medio que todavía cuenta como "parejo". */
export const EVEN_GAP = 75
/** "De mi nivel": hasta esta diferencia de ELO medio. */
export const MY_LEVEL_GAP = 150

const MIN = 60_000
const HOUR = 60 * MIN
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/** "Ahora", "en 40 min", "en 2 h", "hoy 22:00", "mañana 21:00", "sáb 15/11 21:00" o "A convenir". */
export function whenLabel(startsAt: string | null, now: Date): string {
  if (!startsAt) return "A convenir"
  const d = new Date(startsAt)
  const diff = d.getTime() - now.getTime()
  if (Math.abs(diff) <= 15 * MIN) return "Ahora"
  if (diff < 0) return `Hace ${agoLabel(startsAt, now, false)}`
  if (diff < HOUR) return `En ${Math.round(diff / MIN)} min`
  if (diff < 3 * HOUR) return `En ${Math.round(diff / HOUR)} h`
  if (sameDay(d, now)) return `Hoy ${hhmm(d)}`
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (sameDay(d, tomorrow)) return `Mañana ${hhmm(d)}`
  return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} ${hhmm(d)}`
}

/** "hace 25 min", "hace 3 h", "hace 2 días" (sin "hace" si `prefix` es false). */
export function agoLabel(iso: string, now: Date, prefix = true): string {
  const ms = Math.max(0, now.getTime() - new Date(iso).getTime())
  const text =
    ms < HOUR
      ? `${Math.max(1, Math.round(ms / MIN))} min`
      : ms < 24 * HOUR
        ? `${Math.round(ms / HOUR)} h`
        : Math.round(ms / (24 * HOUR)) === 1
          ? "1 día"
          : `${Math.round(ms / (24 * HOUR))} días`
  return prefix ? `hace ${text}` : text
}

/** Cuenta regresiva: "1 h 05 min", "12:30" (menos de una hora), o null si ya pasó o falta un día. */
export function countdown(startsAt: string | null, now: Date): string | null {
  if (!startsAt) return null
  const ms = new Date(startsAt).getTime() - now.getTime()
  if (ms <= 0 || ms >= 24 * HOUR) return null
  if (ms >= HOUR) {
    const h = Math.floor(ms / HOUR)
    const m = Math.floor((ms % HOUR) / MIN)
    return `${h} h ${String(m).padStart(2, "0")} min`
  }
  const m = Math.floor(ms / MIN)
  const s = Math.floor((ms % MIN) / 1000)
  return `${m}:${String(s).padStart(2, "0")}`
}

/** En qué franja cae una hora: ahora (±1 h), hoy, más adelante o a convenir. */
export function timeBucket(
  startsAt: string | null,
  now: Date
): Exclude<TimeFilter, "all"> | "tbd" {
  if (!startsAt) return "tbd"
  const d = new Date(startsAt)
  if (Math.abs(d.getTime() - now.getTime()) <= HOUR) return "now"
  return sameDay(d, now) ? "today" : "later"
}

/** ELO medio de los jugadores con cuenta (los invitados no tienen). */
export function avgElo(roster: PcwPlayer[]): number {
  const acc = roster.filter((p) => !p.guest)
  return acc.length
    ? Math.round(acc.reduce((s, p) => s + p.elo, 0) / acc.length)
    : 0
}

export type Balance = {
  label: string
  tone: "even" | "up" | "down"
  gap: number
}

/** Compara el ELO medio de mi roster con el del rival: "Parejo", "Ellos +120" o "Ustedes +120". */
export function balance(mine: number, theirs: number): Balance {
  const gap = theirs - mine
  if (Math.abs(gap) <= EVEN_GAP) return { label: "Parejo", tone: "even", gap }
  return gap > 0
    ? { label: `Ellos +${gap}`, tone: "up", gap }
    : { label: `Ustedes +${-gap}`, tone: "down", gap }
}

/** Filtra el tablón. `myElo` es el ELO medio de mi último roster. */
export function filterPosts(
  posts: PcwPost[],
  f: PcwFilters,
  myElo: number,
  now: Date
): PcwPost[] {
  return posts.filter((p) => {
    if (f.bo && p.best_of !== f.bo) return false
    if (f.time !== "all" && timeBucket(p.starts_at, now) !== f.time)
      return false
    if (f.kind === "team" && !p.side.team) return false
    if (f.kind === "mix" && p.side.team) return false
    if (f.myLevel && Math.abs(avgElo(p.side.roster) - myElo) > MY_LEVEL_GAP)
      return false
    return true
  })
}

/** Lo que impide publicar o aceptar, en el orden en que conviene arreglarlo. Vacío: se puede. */
export function rosterIssues(
  roster: PcwPlayer[],
  opts: { banned?: string | null; bo?: BestOf; formats?: BestOf[] } = {}
): string[] {
  const out: string[] = []
  if (opts.banned) out.push(opts.banned)
  const accounts = roster.filter((p) => !p.guest).length
  if (accounts < MIN_ACCOUNTS) {
    const n = MIN_ACCOUNTS - accounts
    out.push(
      `Te ${n === 1 ? "falta 1 jugador" : `faltan ${n} jugadores`} con cuenta (mínimo ${MIN_ACCOUNTS}).`
    )
  }
  if (roster.length > MAX_ROSTER)
    out.push(`El roster es de hasta ${MAX_ROSTER} jugadores.`)
  if (opts.bo && opts.formats && !opts.formats.includes(opts.bo))
    out.push(`El formato BO${opts.bo} no está habilitado para las PCW.`)
  return out
}

/** Historial entre dos equipos en sus últimas `limit` PCW: "2-1 en las últimas 3". */
export function headToHead(
  results: PcwResult[],
  us: string,
  them: string,
  limit = 5
): { wins: number; losses: number; label: string } | null {
  const games = results
    .filter(
      (r) =>
        (r.a.id === us && r.b.id === them) || (r.a.id === them && r.b.id === us)
    )
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, limit)
  if (!games.length) return null
  let wins = 0
  for (const g of games) {
    const [sa, sb] = g.score
    if ((g.a.id === us && sa > sb) || (g.b.id === us && sb > sa)) wins++
  }
  const losses = games.length - wins
  const n = games.length
  return {
    wins,
    losses,
    label: `${wins}-${losses} en ${n === 1 ? "la última" : `las últimas ${n}`}`,
  }
}

/** Porcentaje de PCW jugadas sobre las acordadas (jugadas + canceladas + abandonadas). */
export function reliabilityPct(r: {
  played: number
  cancelled: number
  abandoned: number
}): number {
  const total = r.played + r.cancelled + r.abandoned
  return total ? Math.round((r.played / total) * 100) : 100
}

/** Nombre que se muestra de un bando: el del equipo si juega como equipo. */
export const sideName = (s: PcwSide) => s.team?.name ?? s.name

/** Link para compartir un anuncio o una práctica. */
export const pcwLink = (origin: string, id: string, kind: "post" | "match") =>
  kind === "post" ? `${origin}/pcw?anuncio=${id}` : `${origin}/match/${id}`

const icsDate = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")

const icsText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")

/** Evento de calendario (.ics) de una PCW con hora. Dura 45 min por mapa. */
export function icsFor(opts: {
  id: string
  title: string
  startsAt: string
  bestOf: BestOf
  url: string
  now: Date
}): string {
  const start = new Date(opts.startsAt)
  const end = new Date(start.getTime() + opts.bestOf * 45 * MIN)
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CM League//PCW//ES",
    "BEGIN:VEVENT",
    `UID:${opts.id}@cmleague.lat`,
    `DTSTAMP:${icsDate(opts.now)}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(opts.title)}`,
    `URL:${opts.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(opts.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n")
}
