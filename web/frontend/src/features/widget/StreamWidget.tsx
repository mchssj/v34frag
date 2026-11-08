import { cn } from "cn"
import type { CSSProperties, ReactNode } from "react"

import { CountryFlag } from "@/components/brand/CountryFlag"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import type { COUNTRIES } from "@/features/profile/lib/schemas"

import {
  DEFAULT_OPTIONS,
  PERIOD_LABEL,
  STAT_LABEL,
  type Part,
  type StatKey,
  type WidgetOptions,
} from "./options"

// Widget para OBS (docs/bitacora/2026-10-29-widget-streamers y 2026-11-08-widget-streamers-stats en
// kyan/pruebas). Siempre se dibuja oscuro porque va encima del video del stream. Los datos son los de
// widget_player() para el período elegido; las stats nuevas salen del reporter 2.7.0 en adelante.

export type WidgetResult = "V" | "D" | "E"
export type { WidgetDesign, WidgetPeriod } from "./options"
export { WIDGET_SIZE } from "./options"

/** Lo que pasó en el período elegido (hoy, 24 h, temporada o histórico). */
export interface PeriodStats {
  v: number
  d: number
  e: number
  /** ELO ganado o perdido en el período. */
  elo: number
  kills: number
  deaths: number
  rounds: number
  damage: number
  headshots: number
  k3: number
  k4: number
  k5: number
  /** Kills con AWP y Scout (`weapon_kills`). */
  sniper: number
  knife: number
  clutches: number
  entries: number
  pistols: number
  rating: number | null
}

export interface WidgetData {
  nick: string
  team_tag: string | null
  country: (typeof COUNTRIES)[number] | null
  elo: number
  peak_elo: number
  /** Puesto en el ranking general y en el de su país (null sin puesto). */
  rank: number | null
  country_rank: number | null
  period: PeriodStats
  /** Últimos resultados, del más nuevo al más viejo (hasta 10). */
  ultimos: { r: WidgetResult; elo: number | null }[]
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
const ratio = (a: number, b: number) =>
  b ? (a / b).toFixed(2) : a ? a.toFixed(2) : "-"

/** El valor de una stat para mostrar, con su tono si es buena o mala. */
export function statValue(
  k: StatKey,
  d: WidgetData
): { value: string; tone?: "up" | "down" } {
  const p = d.period
  switch (k) {
    case "adr":
      return { value: p.rounds ? String(Math.round(p.damage / p.rounds)) : "-" }
    case "rating":
      return { value: p.rating == null ? "-" : p.rating.toFixed(2) }
    case "kd":
      return {
        value: ratio(p.kills, p.deaths),
        tone: p.kills >= p.deaths ? "up" : "down",
      }
    case "kr":
      return { value: ratio(p.kills, p.rounds) }
    case "hs":
      return {
        value: p.kills ? `${Math.round((p.headshots / p.kills) * 100)}%` : "-",
      }
    case "record":
      return { value: `${p.v}-${p.d}${p.e ? `-${p.e}` : ""}` }
    case "elo_delta":
      return {
        value: signed(p.elo),
        tone: p.elo > 0 ? "up" : p.elo < 0 ? "down" : undefined,
      }
    case "aces":
      return { value: String(p.k5) }
    case "quadros":
      return { value: String(p.k4) }
    case "triples":
      return { value: String(p.k3) }
    case "sniper":
      return { value: String(p.sniper) }
    case "knife":
      return { value: String(p.knife) }
    case "clutches":
      return { value: String(p.clutches) }
    case "entries":
      return { value: String(p.entries) }
    case "pistols":
      return { value: String(p.pistols) }
    case "matches":
      return { value: String(p.v + p.d + p.e) }
    case "peak":
      return { value: d.peak_elo.toLocaleString("es-AR") }
    case "rank":
      return { value: d.rank ? `#${d.rank}` : "-" }
    case "country_rank":
      return { value: d.country_rank ? `#${d.country_rank}` : "-" }
  }
}

/** Racha de victorias actual, contando desde el último resultado. */
const streak = (d: WidgetData) => {
  let n = 0
  for (const u of d.ultimos) {
    if (u.r !== "V") break
    n++
  }
  return n
}

/** La frase que sale sola si el streamer no escribió una. Vacía si no hay nada para destacar. */
export function autoPhrase(d: WidgetData, o: WidgetOptions) {
  const s = streak(d)
  if (d.rank === 1) return "Primero del ranking"
  if (s >= 3) return `Racha de ${s} victorias`
  if (d.rank !== null && d.rank <= 10) return `Top 10 del ranking (#${d.rank})`
  if (d.period.elo >= 50)
    return `${signed(d.period.elo)} ELO ${o.period === "hoy" ? "hoy" : PERIOD_LABEL[o.period].toLowerCase()}`
  if (d.country_rank === 1) return "Primero de su país"
  return ""
}

export function LevelRing({ level, size }: { level: number; size: number }) {
  return (
    <img
      src={`/niveles/nivel_${String(level).padStart(2, "0")}.svg`}
      alt={`Nivel ${level}`}
      width={size}
      height={size}
      className="shrink-0"
    />
  )
}

const RESULT_CLASS: Record<WidgetResult, string> = {
  V: "bg-win",
  D: "bg-destructive",
  E: "bg-muted-foreground",
}

function Results({
  d,
  o,
  size = 18,
}: {
  d: WidgetData
  o: WidgetOptions
  size?: number
}) {
  return (
    <span className="flex gap-1">
      {d.ultimos.slice(0, o.last).map((m, i) => (
        <span
          key={i}
          title={m.elo == null ? "Sin ELO" : `${signed(m.elo)} ELO`}
          style={{ width: size, height: size }}
          className={cn(
            "grid place-items-center rounded-[4px] text-[11px] font-extrabold text-background",
            RESULT_CLASS[m.r]
          )}
        >
          {m.r}
        </span>
      ))}
    </span>
  )
}

function StatBlock({
  k,
  d,
  big,
}: {
  k: StatKey
  d: WidgetData
  big?: boolean
}) {
  const s = statValue(k, d)
  return (
    <span className="flex flex-col items-center">
      <span
        className={cn(
          "font-extrabold tabular-nums",
          big ? "text-[20px] leading-6" : "text-[15px]",
          s.tone === "up" && "text-win",
          s.tone === "down" && "text-destructive"
        )}
      >
        {s.value}
      </span>
      <span className="text-[10px] font-semibold tracking-[0.4px] text-muted-foreground uppercase">
        {STAT_LABEL[k]}
      </span>
    </span>
  )
}

function Progress({ d }: { d: WidgetData }) {
  const level = levelOf(d.elo, LEVEL_FLOORS)
  const floor = LEVEL_FLOORS[level - 1]!
  const next = level < 10 ? LEVEL_FLOORS[level]! : null
  const pct =
    next === null
      ? 100
      : Math.min(100, Math.max(0, ((d.elo - floor) / (next - floor)) * 100))
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
        <span>
          {next === null ? "Nivel 10" : `Nivel ${level} → ${level + 1}`}
        </span>
        <span>
          {next === null ? "Nivel máximo" : `faltan ${next - d.elo} ELO`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[var(--w-acc)] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Name({
  d,
  o,
  className,
}: {
  d: WidgetData
  o: WidgetOptions
  className?: string
}) {
  if (!shows(o, "nick")) return null
  return (
    <span className={cn("truncate font-bold", className)}>
      {shows(o, "tag") && d.team_tag && (
        <span className="mr-1 font-semibold text-muted-foreground">
          {d.team_tag}
        </span>
      )}
      {d.nick}
    </span>
  )
}

const shows = (o: WidgetOptions, p: Part) => !o.hidden.includes(p)

/** El marco común: fondo con la opacidad elegida, borde de acento y tamaño. */
function Frame({
  o,
  className,
  children,
}: {
  o: WidgetOptions
  className?: string
  children: ReactNode
}) {
  const style = {
    "--w-acc": `#${o.accent}`,
    backgroundColor: `rgb(0 0 0 / ${o.opacity / 100})`,
    // `zoom` escala también el tamaño que ocupa, así entra en la fuente de navegador de OBS.
    zoom: o.scale / 100,
  } as CSSProperties
  return (
    <div
      style={style}
      className={cn(
        "dark inline-flex flex-col gap-2.5 rounded-xl border border-white/10 text-foreground shadow-lg",
        o.opacity > 0 && "backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  )
}

function Phrase({
  d,
  o,
  className,
}: {
  d: WidgetData
  o: WidgetOptions
  className?: string
}) {
  if (!shows(o, "phrase")) return null
  const text = o.phrase.trim() || autoPhrase(d, o)
  if (!text) return null
  return (
    <span
      className={cn(
        "truncate text-[12px] font-semibold text-[var(--w-acc)]",
        className
      )}
    >
      {text}
    </span>
  )
}

/** Mini, Compacto y Completo: los diseños de antes, con las opciones nuevas. */
function Classic({ d, o }: { d: WidgetData; o: WidgetOptions }) {
  const level = levelOf(d.elo, LEVEL_FLOORS)
  const p = d.period
  const when = o.period === "hoy" ? "hoy" : PERIOD_LABEL[o.period].toLowerCase()
  const mini = o.design === "mini"
  return (
    <Frame
      o={o}
      className={cn(
        "border-l-[3px] border-l-[var(--w-acc)] px-3.5 py-2.5",
        mini && "px-3 py-1.5",
        o.design === "compacto" && "w-[340px]",
        o.design === "completo" && "w-[400px]"
      )}
    >
      <div className="flex items-center gap-2.5">
        {shows(o, "level") && <LevelRing level={level} size={mini ? 34 : 40} />}
        <div className="min-w-0">
          {!mini && <Name d={d} o={o} className="block text-[15px]" />}
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold tabular-nums">
              {d.elo.toLocaleString("es-AR")}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">
              ELO
            </span>
          </div>
        </div>
        {!mini && <Phrase d={d} o={o} className="ml-auto max-w-[45%]" />}
      </div>
      {!mini && (
        <>
          {shows(o, "progress") && <Progress d={d} />}
          <div className="flex gap-4">
            <ClassicStat
              label={when}
              value={`${p.v}V - ${p.d}D${p.e ? ` - ${p.e}E` : ""}`}
            />
            <ClassicStat
              label={`ELO ${when}`}
              value={signed(p.elo)}
              tone={p.elo > 0 ? "up" : p.elo < 0 ? "down" : undefined}
            />
            {o.design === "completo" && (
              <>
                <ClassicStat
                  label={`K/D ${when}`}
                  value={ratio(p.kills, p.deaths)}
                />
                <ClassicStat
                  label="Rating"
                  value={p.rating == null ? "-" : p.rating.toFixed(2)}
                />
                <ClassicStat
                  label="Pico"
                  value={d.peak_elo.toLocaleString("es-AR")}
                />
              </>
            )}
          </div>
          {o.design === "completo" &&
            shows(o, "last") &&
            d.ultimos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-[0.4px] text-muted-foreground uppercase">
                  Últimos
                </span>
                <Results d={d} o={o} size={20} />
              </div>
            )}
        </>
      )}
    </Frame>
  )
}

function ClassicStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "up" | "down"
}) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] font-semibold tracking-[0.4px] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-[15px] font-bold tabular-nums",
          tone === "up" && "text-win",
          tone === "down" && "text-destructive"
        )}
      >
        {value}
      </span>
    </span>
  )
}

/** Stats: la tarjeta completa, con nivel, ELO, stats grandes, frase, stats chicas y la última fila. */
function StatsCard({ d, o }: { d: WidgetData; o: WidgetOptions }) {
  const level = levelOf(d.elo, LEVEL_FLOORS)
  const hs = statValue("hs", d).value
  return (
    <Frame o={o} className="w-[400px] gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-3 px-3.5 pt-3">
        {shows(o, "level") && (
          <span className="flex flex-col items-center">
            <LevelRing level={level} size={52} />
            {d.rank && (
              <span className="text-[11px] font-bold text-[var(--w-acc)]">
                #{d.rank}
              </span>
            )}
          </span>
        )}
        <span className="flex min-w-[88px] shrink-0 flex-col">
          <Name d={d} o={o} className="max-w-[110px] text-[13px]" />
          <span className="flex items-baseline gap-1">
            <span className="text-[24px] leading-7 font-extrabold tabular-nums">
              {d.elo.toLocaleString("es-AR")}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              ELO
            </span>
          </span>
        </span>
        <span className="ml-auto grid grid-flow-col gap-2.5">
          {o.top.map((k) => (
            <StatBlock key={k} k={k} d={d} big />
          ))}
        </span>
      </div>
      <div className="flex min-h-5 items-center justify-end px-3.5 pb-2">
        <Phrase d={d} o={o} />
      </div>
      {o.chips.length > 0 && (
        <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-white/10 px-3.5 py-2 text-[11px]">
          {o.chips.map((k) => (
            <span key={k}>
              <span className="font-semibold text-muted-foreground uppercase">
                {STAT_LABEL[k]}:{" "}
              </span>
              <span className="font-extrabold tabular-nums">
                {statValue(k, d).value}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 border-t border-white/10 px-3.5 py-2 text-[11px]">
        <span>
          <span className="font-semibold text-muted-foreground">HS: </span>
          <span className="font-extrabold">{hs}</span>
        </span>
        {d.rank && (
          <span>
            <span className="font-semibold text-muted-foreground">
              Ranking:{" "}
            </span>
            <span className="font-extrabold">#{d.rank}</span>
          </span>
        )}
        {d.country && d.country_rank && (
          <span className="inline-flex items-center gap-1">
            {shows(o, "flag") && (
              <CountryFlag country={d.country} className="h-3 w-auto" />
            )}
            <span className="font-extrabold">#{d.country_rank}</span>
          </span>
        )}
        {shows(o, "last") && (
          <span className="ml-auto">
            <Results d={d} o={o} size={16} />
          </span>
        )}
      </div>
    </Frame>
  )
}

/** Barra: una tira horizontal para abajo de la pantalla. */
function Bar({ d, o }: { d: WidgetData; o: WidgetOptions }) {
  const level = levelOf(d.elo, LEVEL_FLOORS)
  return (
    <Frame
      o={o}
      className="w-[710px] flex-row items-center gap-4 border-b-2 border-b-[var(--w-acc)] px-3 py-1.5"
    >
      {shows(o, "level") && <LevelRing level={level} size={36} />}
      <span className="flex min-w-0 flex-col leading-tight">
        <Name d={d} o={o} className="text-[13px]" />
        <span className="flex items-baseline gap-1">
          <span className="text-[18px] font-extrabold tabular-nums">
            {d.elo.toLocaleString("es-AR")}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">
            ELO
          </span>
          {shows(o, "flag") && d.country && (
            <CountryFlag country={d.country} className="ml-1 h-3 w-auto" />
          )}
        </span>
      </span>
      <span className="h-8 w-px bg-white/10" />
      <span className="flex gap-4">
        {o.top.map((k) => (
          <StatBlock key={k} k={k} d={d} />
        ))}
      </span>
      <Phrase d={d} o={o} className="min-w-0 flex-1 text-center" />
      {shows(o, "last") && (
        <span className="ml-auto">
          <Results d={d} o={o} size={18} />
        </span>
      )}
    </Frame>
  )
}

/** Vertical: una columna angosta para el costado de la cámara. */
function Column({ d, o }: { d: WidgetData; o: WidgetOptions }) {
  const level = levelOf(d.elo, LEVEL_FLOORS)
  const rows = [...o.top, ...o.chips]
  return (
    <Frame
      o={o}
      className="w-[190px] items-stretch border-t-[3px] border-t-[var(--w-acc)] px-3 py-3"
    >
      <span className="flex flex-col items-center gap-1 text-center">
        {shows(o, "level") && <LevelRing level={level} size={64} />}
        <Name d={d} o={o} className="max-w-full text-[14px]" />
        <span className="flex items-baseline gap-1">
          <span className="text-[24px] leading-7 font-extrabold tabular-nums">
            {d.elo.toLocaleString("es-AR")}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground">
            ELO
          </span>
        </span>
        <Phrase d={d} o={o} className="max-w-full" />
      </span>
      {shows(o, "progress") && <Progress d={d} />}
      <ul className="flex flex-col divide-y divide-white/10 text-[12px]">
        {rows.map((k) => {
          const s = statValue(k, d)
          return (
            <li key={k} className="flex items-center justify-between py-1">
              <span className="font-semibold text-muted-foreground uppercase">
                {STAT_LABEL[k]}
              </span>
              <span
                className={cn(
                  "font-extrabold tabular-nums",
                  s.tone === "up" && "text-win",
                  s.tone === "down" && "text-destructive"
                )}
              >
                {s.value}
              </span>
            </li>
          )
        })}
      </ul>
      {shows(o, "last") && (
        <span className="flex justify-center">
          <Results d={d} o={o} size={o.last === 10 ? 14 : 20} />
        </span>
      )}
    </Frame>
  )
}

export function StreamWidget({
  data,
  options,
}: {
  data: WidgetData
  options?: Partial<WidgetOptions>
}) {
  const o = { ...DEFAULT_OPTIONS, ...options }
  if (o.design === "stats") return <StatsCard d={data} o={o} />
  if (o.design === "barra") return <Bar d={data} o={o} />
  if (o.design === "vertical") return <Column d={data} o={o} />
  return <Classic d={data} o={o} />
}
