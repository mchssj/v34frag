import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  LoaderIcon,
  RotateCcwIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react"
import { toast } from "sonner"

import heroAvif from "@/assets/landing-bg.avif"
import heroWebp from "@/assets/landing-bg.webp"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { PlayerAvatar } from "@/components/brand/PlayerAvatar"
import { StatTile } from "@/components/brand/StatTile"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMediaQuery } from "@/lib/useMediaQuery"
import { Medal } from "@/features/medals/Medal"
import { defaultLook, templateOf } from "@/features/medals/templates"
import { EloChart } from "@/features/player/components/EloChart"
import { LEVEL_FLOORS } from "@/features/player/lib/labels"
import type { RecapPlayer, SeasonRecap, StatKey } from "./data"
import { FullClips, StoryClips } from "./clips"
import { renderRecap, saveJpeg, savePdf } from "./export"
import { Hint, PersonLink, StatHint, fmt, pctText, statLabel } from "./hints"

// Visor del recap de una temporada: slides en formato historia, sin avance automático (flechas o
// tocar a los costados, Esc para salir). Después del cierre, la tarjeta se agranda hasta ocupar la
// pantalla y muestra todas las estadísticas, con el fondo de la landing. Cada cifra tiene un globo
// con el promedio de la temporada, y cada persona, el suyo con su temporada y el link a su perfil.

type Slide = { id: string; accent: string; render: () => ReactNode }
type Phase = "story" | "full"

const heroImage = `image-set(url("${heroAvif}") type("image/avif"), url("${heroWebp}") type("image/webp"))`

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}`
const mapLabel = (m: string) =>
  m.replace(/^(de|cs)_/, "").replace(/_(rc\d|ob|classic)$/, "")
const dateLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" })
const WEAPONS: Record<string, string> = {
  ak47: "AK-47",
  m4a1: "M4A1",
  awp: "AWP",
  deagle: "Desert Eagle",
  usp: "USP",
  glock: "Glock",
  famas: "FAMAS",
  galil: "Galil",
}

// Cálculos que usan las slides y la vista completa.
function derived(r: SeasonRecap) {
  const played = r.record.wins + r.record.losses
  const wr = played ? Math.round((r.record.wins / played) * 100) : 0
  const kd = r.numbers.deaths ? r.numbers.kills / r.numbers.deaths : r.numbers.kills
  const delta = r.elo.end - r.elo.start
  const byPlays = [...r.maps].sort((a, b) => b.matches - a.matches)
  const mostPlayed = byPlays[0]
  // El de más victorias, con al menos 3 mixes para que no gane un mapa jugado una vez.
  const bestMap =
    [...r.maps].filter((m) => m.matches >= 3).sort((a, b) => b.wins / b.matches - a.wins / a.matches)[0] ??
    mostPlayed
  const values: Record<StatKey, number> = {
    matches: r.mixes.matches,
    rounds: r.mixes.rounds,
    hours: r.mixes.hours,
    win_pct: wr,
    best_streak: r.record.best_streak,
    kills: r.numbers.kills,
    deaths: r.numbers.deaths,
    assists: r.numbers.assists,
    kd,
    hs_pct: r.numbers.hs_pct,
    adr: r.numbers.adr,
    mvps: r.numbers.mvps,
    first_kills: r.numbers.first_kills,
    k4: r.numbers.k4,
    aces: r.numbers.aces,
    elo_delta: delta,
    rating: r.numbers.rating,
  }
  // Tus mejores marcas: los percentiles más altos (las muertes no cuentan como marca).
  const marks = (Object.keys(r.compare) as StatKey[])
    .filter((k) => k !== "deaths" && r.compare[k].pct >= 60)
    .sort((a, b) => r.compare[b].pct - r.compare[a].pct)
    .slice(0, 3)
  return {
    wr,
    kd,
    delta,
    mostPlayed,
    bestMap,
    values,
    marks,
    medalTpl: r.final.medal ? templateOf(r.final.medal.template) : undefined,
  }
}

type Ctx = { r: SeasonRecap; d: ReturnType<typeof derived> }
const RecapCtx = createContext<Ctx | null>(null)
const useRecap = () => useContext(RecapCtx)!

/** Una cifra con su globo de promedio. */
function S({ k, className, children }: { k: StatKey; className?: string; children: ReactNode }) {
  const { r, d } = useRecap()
  return (
    <StatHint k={k} value={d.values[k]} compare={r.compare} players={r.season.players} className={className}>
      {children}
    </StatHint>
  )
}

export function RecapViewer({
  recap,
  onClose,
}: {
  recap: SeasonRecap
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>("story")
  const [i, setI] = useState(0)
  const full = phase === "full"
  const toFull = useCallback(() => setPhase("full"), [])
  const ctx = useMemo(() => ({ r: recap, d: derived(recap) }), [recap])
  const slides = useMemo(() => buildSlides(ctx, toFull), [ctx, toFull])
  const last = slides.length - 1
  // Avanzar desde la última slide abre la vista completa.
  const go = useCallback(
    (d: number) => {
      if (d > 0 && i === last) return setPhase("full")
      setI(Math.max(0, Math.min(last, i + d)))
    },
    [i, last]
  )
  const replay = () => {
    setI(0)
    setPhase("story")
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (full) return
      else if (e.key === "ArrowRight" || e.key === " ") go(1)
      else if (e.key === "ArrowLeft") go(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [go, onClose, full])

  const slide = slides[i]
  return (
    <RecapCtx.Provider value={ctx}>
      <div
        role="dialog"
        aria-modal
        aria-label={`Recap de la ${recap.season.name}`}
        className="fixed inset-0 z-50 flex items-center justify-center gap-4 bg-black/85 backdrop-blur-sm"
      >
        {!full && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Anterior"
            onClick={() => go(-1)}
            disabled={i === 0}
            className="hidden rounded-full text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <ChevronLeftIcon />
          </Button>
        )}

        <div
          className={cn(
            "dark relative isolate flex flex-col overflow-hidden bg-background text-foreground transition-[width,height,border-radius] duration-700 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none",
            full
              ? "h-dvh w-screen rounded-none"
              : "h-dvh w-screen sm:h-[min(860px,94vh)] sm:w-[calc(min(860px,94vh)*9/16)] sm:rounded-hero sm:border sm:border-white/10"
          )}
          style={{ "--accent": full ? "var(--primary)" : slide.accent } as CSSProperties}
        >
          {/* Brillo del color de la slide (en la historia). */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 -z-10 transition-[background,opacity] duration-700 [background:radial-gradient(120%_70%_at_50%_0%,color-mix(in_oklch,var(--accent)_38%,transparent),transparent_70%),radial-gradient(90%_50%_at_100%_100%,color-mix(in_oklch,var(--accent)_18%,transparent),transparent_70%)]",
              full && "opacity-0"
            )}
          />
          {/* Fondo de la landing (en la vista completa), con los mismos filtros que en modo oscuro. */}
          <span
            aria-hidden
            style={{ backgroundImage: heroImage }}
            className={cn(
              "pointer-events-none absolute inset-0 -z-20 bg-cover bg-right bg-no-repeat contrast-[1.2] mix-blend-screen invert transition-opacity delay-200 duration-1000",
              full ? "opacity-20" : "opacity-0"
            )}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--background)_0%,var(--background)_32%,transparent_70%)] transition-opacity duration-1000",
              full ? "opacity-100" : "opacity-0"
            )}
          />

          {full ? (
            <FullStats onReplay={replay} onClose={onClose} />
          ) : (
            <>
              <header className="relative z-20 flex flex-col gap-3 px-4 pt-4">
                <div className="flex gap-1" aria-hidden>
                  {slides.map((s, k) => (
                    <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
                      <span
                        className={cn(
                          "block h-full bg-white transition-[width] duration-300",
                          k <= i ? "w-full" : "w-0"
                        )}
                      />
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2.5">
                  <PlayerAvatar alias={recap.player.nick} photo={recap.player.photo} className="size-8" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold">{recap.player.nick}</span>
                    <span className="text-xs text-muted-foreground">Recap · {recap.season.name}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Cerrar el recap"
                    onClick={onClose}
                    className="ml-auto rounded-full"
                  >
                    <XIcon />
                  </Button>
                </div>
              </header>

              {/* Zonas para tocar: izquierda vuelve, derecha avanza. */}
              <button
                type="button"
                aria-label="Anterior"
                tabIndex={-1}
                onClick={() => go(-1)}
                className="absolute inset-y-0 left-0 z-10 w-[30%] cursor-w-resize"
              />
              <button
                type="button"
                aria-label="Siguiente"
                tabIndex={-1}
                onClick={() => go(1)}
                className="absolute inset-y-0 right-0 z-10 w-[70%] cursor-e-resize"
              />

              {/* Lo interactivo (globos, links, gráfico) queda por encima de las zonas para tocar. */}
              <section
                key={slide.id}
                aria-live="polite"
                className="pointer-events-none relative flex flex-1 flex-col justify-center gap-6 px-7 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_[data-interactive]]:pointer-events-auto [&_a]:relative [&_a]:z-20 [&_button]:relative [&_button]:z-20 [&_[data-interactive]]:relative [&_[data-interactive]]:z-20"
              >
                {slide.render()}
              </section>

              <footer className="relative z-20 flex items-center justify-between px-4 pb-4 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {i + 1} / {slides.length}
                </span>
                {i < last ? (
                  <button
                    type="button"
                    onClick={() => setI(last)}
                    className="rounded-md px-2 py-1 hover:bg-white/10 hover:text-foreground"
                  >
                    Saltar al resumen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setI(0)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10 hover:text-foreground"
                  >
                    <RotateCcwIcon className="size-3.5" /> Ver de nuevo
                  </button>
                )}
              </footer>
            </>
          )}
        </div>

        {!full && (
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={i === last ? "Ver todas las estadísticas" : "Siguiente"}
            onClick={() => go(1)}
            className="hidden rounded-full text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </RecapCtx.Provider>
  )
}

// ---------- Piezas ----------

function useCountUp(value: number, ms = 900) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)")
  const [v, setV] = useState(0)
  useEffect(() => {
    if (reduced) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms, reduced])
  // Con movimiento reducido, la cifra final directo y sin animar.
  return reduced ? value : v
}

function Count({ value, decimals = 0 }: { value: number; decimals?: number }) {
  return <>{fmt(useCountUp(value), decimals)}</>
}

function Big({ value, decimals = 0, suffix }: { value: number; decimals?: number; suffix?: string }) {
  return (
    <span className="font-mono text-[clamp(48px,15vw,68px)] leading-none font-semibold tracking-[-2px] whitespace-nowrap tabular-nums">
      <Count value={value} decimals={decimals} />
      {suffix && <span className="text-[0.45em] tracking-normal text-muted-foreground">{suffix}</span>}
    </span>
  )
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs font-semibold tracking-[1.5px] text-[var(--accent)] uppercase">
      {children}
    </span>
  )
}

function Title({ children }: { children: ReactNode }) {
  return <h2 className="text-[26px] leading-tight font-semibold text-balance">{children}</h2>
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-balance text-muted-foreground">{children}</p>
}

const box = "rounded-xl border border-white/10 bg-white/[0.04]"

function Kv({ label, k, children }: { label: string; k?: StatKey; children: ReactNode }) {
  const inner = (
    <div className={cn("flex h-full flex-col gap-0.5 p-3", box)}>
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xl font-semibold tabular-nums">{children}</dd>
    </div>
  )
  return k ? <S k={k}>{inner}</S> : inner
}

function PersonRow({ p, lines, children }: { p: RecapPlayer; lines: [string, string][]; children: ReactNode }) {
  return (
    <PersonLink p={p} lines={lines} className={cn("flex items-center gap-3 p-3", box)}>
      <PlayerAvatar alias={p.nick} photo={p.photo} className="size-11" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{p.nick}</span>
        <span className="text-xs text-muted-foreground">{children}</span>
      </span>
      <LevelBadge level={p.level} size={24} />
    </PersonLink>
  )
}

function Radar({ map, className }: { map: string; className?: string }) {
  return (
    <img
      src={`/radar/${map}.svg`}
      alt=""
      aria-hidden
      onError={(e) => (e.currentTarget.style.display = "none")}
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[120%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.07]",
        className
      )}
    />
  )
}

/** El gráfico de ELO del perfil, con el piso del nivel final. */
function Elo({ className }: { className?: string }) {
  const { r } = useRecap()
  const level = r.final.level
  return (
    <div data-interactive className={cn("flex", className)}>
      <EloChart points={r.elo.points} level={level} floor={level ? LEVEL_FLOORS[level - 1] : null} />
    </div>
  )
}

const personLines = {
  mate: (p: { together: number; won: number }): [string, string][] => [
    ["Mixes juntos", String(p.together)],
    ["Ganados juntos", `${p.won} (${Math.round((p.won / p.together) * 100)}%)`],
  ],
  rival: (p: { you_killed: number; killed_you: number }): [string, string][] => [
    ["Lo bajaste", `${p.you_killed} veces`],
    ["Te bajó", `${p.killed_you} veces`],
    ["Duelo", `${p.you_killed}–${p.killed_you}`],
  ],
}

// ---------- Slides ----------

function buildSlides({ r, d }: Ctx, onFull: () => void): Slide[] {
  const n = r.numbers
  const { wr, kd, delta, medalTpl, mostPlayed, bestMap, marks } = d

  const slides: (Slide | null)[] = [
    {
      id: "portada",
      accent: "var(--primary)",
      render: () => (
        <>
          <Kicker>{r.season.name} · terminó</Kicker>
          <div className="flex flex-col items-start gap-4">
            <PlayerAvatar
              alias={r.player.nick}
              photo={r.player.photo}
              className="size-24 text-3xl ring-4 ring-[var(--accent)]/40"
            />
            <h2 className="text-[40px] leading-[1.05] font-semibold tracking-[-1px] text-balance">
              {r.player.nick}, esta fue tu temporada
            </h2>
          </div>
          <Note>
            Del {dateLabel(r.season.starts_at)} al {dateLabel(r.season.closed_at)}. Tocá a la derecha para empezar.
            Pasá el mouse por las cifras para compararte con los {r.season.players} que jugaron.
          </Note>
        </>
      ),
    },
    {
      id: "mixes",
      accent: "oklch(0.7 0.15 250)",
      render: () => (
        <>
          <Kicker>Mixes</Kicker>
          <Title>Jugaste</Title>
          <S k="matches" className="self-start">
            <Big value={r.mixes.matches} suffix={r.mixes.matches === 1 ? " mix" : " mixes"} />
          </S>
          <Note>
            {fmt(r.mixes.rounds)} rondas, unas {r.mixes.hours} horas en el servidor. Tu día más
            intenso fue el {dateLabel(r.mixes.busiest_day.date)}: {r.mixes.busiest_day.matches} mixes seguidos.
          </Note>
          <dl className="grid grid-cols-2 gap-2">
            <Kv label="Rondas" k="rounds">{fmt(r.mixes.rounds)}</Kv>
            <Kv label="Horas" k="hours">~{r.mixes.hours}</Kv>
          </dl>
        </>
      ),
    },
    {
      id: "record",
      accent: "var(--win)",
      render: () => (
        <>
          <Kicker>Récord</Kicker>
          <Title>{wr >= 50 ? "Ganaste más de lo que perdiste" : "Cada derrota también suma"}</Title>
          <S k="win_pct" className="flex flex-col gap-4 p-1">
            <div className="flex items-baseline gap-3 font-mono font-semibold tabular-nums">
              <span className="text-[64px] leading-none text-win">{r.record.wins}V</span>
              <span className="text-3xl text-muted-foreground">–</span>
              <span className="text-[64px] leading-none text-destructive">{r.record.losses}D</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
              <span className="bg-win" style={{ width: `${wr}%` }} />
              <span className="bg-destructive/70" style={{ width: `${100 - wr}%` }} />
            </div>
          </S>
          <dl className="grid grid-cols-2 gap-2">
            <Kv label="Victorias" k="win_pct">{wr}%</Kv>
            <Kv label="Mejor racha" k="best_streak">{r.record.best_streak} seguidas</Kv>
          </dl>
        </>
      ),
    },
    {
      id: "elo",
      accent: delta >= 0 ? "var(--level-4)" : "var(--level-10)",
      render: () => (
        <>
          <Kicker>ELO</Kicker>
          <S k="elo_delta" className="self-start">
            <Title>{delta >= 0 ? `Subiste ${fmt(delta)} puntos` : `Bajaste ${fmt(-delta)} puntos`}</Title>
          </S>
          <Elo className="mt-6 h-[190px]" />
          <dl className="grid grid-cols-3 gap-2">
            <Kv label="Empezaste">{fmt(r.elo.start)}</Kv>
            <Kv label="Pico">{fmt(r.elo.peak)}</Kv>
            <Kv label="Terminaste">{fmt(r.elo.end)}</Kv>
          </dl>
        </>
      ),
    },
    {
      id: "numeros",
      accent: "var(--level-10)",
      render: () => (
        <>
          <Kicker>Tus números</Kicker>
          <Title>Bajaste a</Title>
          <S k="kills" className="self-start">
            <Big value={n.kills} suffix=" rivales" />
          </S>
          <dl className="grid grid-cols-3 gap-2">
            <Kv label="K/D" k="kd">{fmt(kd, 2)}</Kv>
            <Kv label="% HS" k="hs_pct">{n.hs_pct}%</Kv>
            <Kv label="ADR" k="adr">{fmt(n.adr, 1)}</Kv>
            <Kv label="MVPs" k="mvps">{n.mvps}</Kv>
            <Kv label="Aperturas" k="first_kills">{n.first_kills}</Kv>
            <Kv label="Aces" k="aces">{n.aces}</Kv>
          </dl>
          {n.aces > 0 && (
            <Note>
              {n.aces === 1 ? "Un ace" : `${n.aces} aces`} y {n.k4} rondas de 4 kills. Nada mal.
            </Note>
          )}
        </>
      ),
    },
    r.weapon
      ? {
          id: "arma",
          accent: "oklch(0.72 0.17 60)",
          render: () => {
            const w = r.weapon!
            return (
              <>
                <Kicker>Tu arma</Kicker>
                <Title>No la soltaste en toda la temporada</Title>
                <span className="text-[60px] leading-none font-bold tracking-[-2px]">{WEAPONS[w.name] ?? w.name}</span>
                <Note>
                  El {w.share_pct}% de tus kills fueron con ella.
                </Note>
                <dl className="grid grid-cols-2 gap-2">
                  <Kv label="Kills con ella">{fmt(w.kills)}</Kv>
                  <Kv label="% HS con ella">{w.hs_pct}%</Kv>
                </dl>
              </>
            )
          },
        }
      : null,
    {
      id: "mapas",
      accent: "oklch(0.75 0.14 195)",
      render: () => (
        <>
          <Radar map={mostPlayed.name} />
          <Kicker>Mapas</Kicker>
          <Title>Tu casa fue</Title>
          <span className="text-[56px] leading-none font-semibold tracking-[-1.5px] capitalize">
            {mapLabel(mostPlayed.name)}
          </span>
          <Note>{mostPlayed.matches} mixes ahí, más que en cualquier otro mapa.</Note>
          {bestMap.name !== mostPlayed.name && (
            <Hint
              text={`${bestMap.wins} ganados de ${bestMap.matches} · K/D ${fmt(bestMap.kd, 2)} en ese mapa`}
              className={cn("p-3", box)}
            >
              <span className="text-xs text-muted-foreground">Pero donde más ganaste fue</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-semibold capitalize">{mapLabel(bestMap.name)}</span>
                <span className="font-mono text-xl font-semibold text-win tabular-nums">
                  {Math.round((bestMap.wins / bestMap.matches) * 100)}%
                </span>
              </div>
            </Hint>
          )}
        </>
      ),
    },
    {
      id: "partida",
      accent: "oklch(0.78 0.16 85)",
      render: () => {
        const m = r.best_match
        return (
          <>
            <Radar map={m.map} />
            <Kicker>Tu mejor partida</Kicker>
            <Title>
              El {dateLabel(m.date)} en <span className="capitalize">{mapLabel(m.map)}</span>
            </Title>
            <Big value={m.kills} suffix=" kills" />
            <dl className="grid grid-cols-3 gap-2">
              <Kv label="Resultado">
                <span className={m.won ? "text-win" : "text-destructive"}>
                  {m.score[0]}–{m.score[1]}
                </span>
              </Kv>
              <Kv label="K/D">{m.kills}/{m.deaths}</Kv>
              <Hint text={`Tu rating promedio fue ${fmt(n.rating, 2)}; el de todos, ${fmt(r.compare.rating.avg, 2)}`}>
                <Kv label="Rating">{fmt(m.rating, 2)}</Kv>
              </Hint>
            </dl>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="self-start text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
            >
              Ver el mix →
            </a>
          </>
        )
      },
    },
    r.clips.length > 0
      ? {
          id: "clips",
          accent: "oklch(0.7 0.2 350)",
          render: () => (
            <>
              <Kicker>Tus mejores jugadas</Kicker>
              <Title>
                {r.clips.length === 1 ? "La jugada de tu temporada" : `Tus ${r.clips.length} mejores clips`}
              </Title>
              <StoryClips clips={r.clips} />
            </>
          ),
        }
      : null,
    {
      id: "companeros",
      accent: "oklch(0.72 0.15 300)",
      render: () => (
        <>
          <Kicker>Compañeros</Kicker>
          <Title>No jugaste solo</Title>
          <PersonRow p={r.mates.most_played} lines={personLines.mate(r.mates.most_played)}>
            Tu compañero más fiel: {r.mates.most_played.together} mixes en el mismo equipo
          </PersonRow>
          {r.mates.most_wins.nick !== r.mates.most_played.nick && (
            <PersonRow p={r.mates.most_wins} lines={personLines.mate(r.mates.most_wins)}>
              Tu dupla ganadora: {r.mates.most_wins.won} de {r.mates.most_wins.together} ganados juntos
            </PersonRow>
          )}
        </>
      ),
    },
    r.rivals.victim && r.rivals.nemesis
      ? {
          id: "rivales",
          accent: "var(--destructive)",
          render: () => (
            <>
              <Kicker>Rivales</Kicker>
              <Title>Algunos te van a recordar</Title>
              <PersonRow p={r.rivals.victim!} lines={personLines.rival(r.rivals.victim!)}>
                Tu víctima favorita: lo bajaste {r.rivals.victim!.you_killed} veces
              </PersonRow>
              <PersonRow p={r.rivals.nemesis!} lines={personLines.rival(r.rivals.nemesis!)}>
                Tu némesis: te bajó {r.rivals.nemesis!.killed_you} veces
              </PersonRow>
            </>
          ),
        }
      : null,
    marks.length > 0
      ? {
          id: "marcas",
          accent: "oklch(0.8 0.15 95)",
          render: () => (
            <>
              <Kicker>Tus mejores marcas</Kicker>
              <Title>En esto estuviste entre los mejores</Title>
              <div className="flex flex-col gap-2">
                {marks.map((k, idx) => (
                  <S key={k} k={k}>
                    <div
                      className={cn("flex items-center gap-3 p-3 animate-in fade-in slide-in-from-left-4 fill-mode-both duration-500", box)}
                      style={{ animationDelay: `${150 + idx * 150}ms` }}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                        <TrophyIcon className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{statLabel(k).split(" (")[0]}</span>
                        <span className="text-xs text-muted-foreground">{pctText(k, r.compare[k].pct)}</span>
                      </span>
                      <span className="font-mono text-lg font-semibold text-[var(--accent)] tabular-nums">
                        Top {Math.max(1, 100 - r.compare[k].pct)}%
                      </span>
                    </div>
                  </S>
                ))}
              </div>
            </>
          ),
        }
      : null,
    {
      id: "cierre",
      accent: r.final.eligible ? "var(--level-4)" : "var(--primary)",
      render: () => (
        <div className="flex flex-col items-center gap-5 text-center">
          <Kicker>{r.season.name} · tu cierre</Kicker>

          {/* Medalla (o nivel) con rayos que giran despacio detrás. */}
          <div className="relative grid size-[184px] place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 animate-[spin_24s_linear_infinite] rounded-full opacity-60 [background:repeating-conic-gradient(from_0deg,color-mix(in_oklch,var(--accent)_45%,transparent)_0deg_6deg,transparent_6deg_22deg)] [mask:radial-gradient(circle,black_30%,transparent_70%)] motion-reduce:animate-none"
            />
            <span
              aria-hidden
              className="absolute inset-6 rounded-full [background:radial-gradient(circle,color-mix(in_oklch,var(--accent)_45%,transparent),transparent_70%)]"
            />
            <span className="relative animate-in zoom-in-50 fade-in duration-700 motion-reduce:animate-none">
              {medalTpl ? (
                <Medal look={defaultLook(medalTpl)} size={128} title={r.final.medal!.name} />
              ) : (
                <LevelBadge level={r.final.level} size={60} className="scale-150" />
              )}
            </span>
          </div>

          {r.final.eligible && r.final.rank !== null ? (
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[84px] leading-none font-semibold tracking-[-3px] tabular-nums">
                #<Count value={r.final.rank} />
              </span>
              <span className="text-sm text-muted-foreground">
                de {r.final.total_ranked} que clasificaron
                {r.final.medal && (
                  <>
                    {" · "}
                    <b className="font-semibold text-[var(--accent)]">{r.final.medal.name}</b>
                  </>
                )}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[34px] leading-tight font-semibold">No clasificaste</span>
              <span className="text-sm text-muted-foreground">
                Te faltaron mixes para entrar al ranking. ¡La próxima!
              </span>
            </div>
          )}

          <div className="grid w-full grid-cols-3 gap-2">
            <S k="elo_delta">
              <Highlight label="ELO" value={signed(delta)} tone={delta >= 0 ? "text-win" : "text-destructive"} />
            </S>
            <S k="win_pct">
              <Highlight label="Victorias" value={`${wr}%`} />
            </S>
            <S k="kd">
              <Highlight label="K/D" value={fmt(kd, 2)} />
            </S>
          </div>

          <div className="flex w-full flex-col gap-2">
            <Button size="lg" className="w-full" onClick={onFull}>
              Ver todas tus estadísticas <ArrowRightIcon />
            </Button>
            <CopyLink className="w-full" variant="ghost" />
          </div>
        </div>
      ),
    },
  ]
  return slides.filter((s): s is Slide => s !== null)
}

function Highlight({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-0.5 px-2 py-3", box)}>
      <span className={cn("font-mono text-xl font-semibold tabular-nums", tone)}>{value}</span>
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
    </div>
  )
}

function CopyLink({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => {
        void navigator.clipboard?.writeText(window.location.href).then(() => setDone(true))
      }}
    >
      <CopyIcon /> {done ? "Link copiado" : "Copiar link"}
    </Button>
  )
}

// ---------- Vista completa ----------

// Cada bloque entra desde abajo, uno detrás del otro, cuando la tarjeta ya se agrandó.
function Reveal({ step, className, children }: { step: number; className?: string; children: ReactNode }) {
  return (
    <div
      style={{ animationDelay: `${350 + step * 90}ms` }}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-6 fill-mode-both duration-700 motion-reduce:animate-none",
        className
      )}
    >
      {children}
    </div>
  )
}

const glass = "bg-background/60 backdrop-blur-md"

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="font-mono text-xs font-semibold tracking-[1.5px] text-primary uppercase">{children}</h3>
      {aside}
    </div>
  )
}

/** Cambio contra la temporada anterior: "▲ 0,15 vs T2". */
function Prev({ now, before, decimals = 0, suffix = "" }: { now: number; before: number; decimals?: number; suffix?: string }) {
  const { r } = useRecap()
  const diff = now - before
  if (!r.prev || Math.abs(diff) < Math.pow(10, -decimals) / 2) return null
  return (
    <span className={cn("text-[11.5px] font-medium tabular-nums", diff > 0 ? "text-win" : "text-destructive")}>
      {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff), decimals)}
      {suffix} vs T{r.season.number - 1}
    </span>
  )
}

function FullStats({ onReplay, onClose }: { onReplay: () => void; onClose: () => void }) {
  const { r, d } = useRecap()
  const n = r.numbers
  const { wr, kd, delta, medalTpl, marks } = d
  const m = r.best_match
  const p = r.prev
  const tiles: { k: StatKey; label: string; value: ReactNode; tone?: string; prev?: ReactNode }[] = [
    { k: "matches", label: "Mixes", value: r.mixes.matches },
    { k: "rounds", label: "Rondas", value: fmt(r.mixes.rounds) },
    { k: "hours", label: "Horas", value: `~${r.mixes.hours}` },
    { k: "win_pct", label: "Victorias", value: `${wr}%`, tone: wr >= 50 ? "text-win" : "text-destructive", prev: p && <Prev now={wr} before={p.win_pct} suffix=" pts" /> },
    { k: "best_streak", label: "Mejor racha", value: r.record.best_streak },
    { k: "kills", label: "Kills", value: fmt(n.kills) },
    { k: "deaths", label: "Muertes", value: fmt(n.deaths) },
    { k: "assists", label: "Asistencias", value: n.assists },
    { k: "kd", label: "K/D", value: fmt(kd, 2), prev: p && <Prev now={kd} before={p.kd} decimals={2} /> },
    { k: "hs_pct", label: "% HS", value: `${n.hs_pct}%`, prev: p && <Prev now={n.hs_pct} before={p.hs_pct} suffix=" pts" /> },
    { k: "adr", label: "ADR", value: fmt(n.adr, 1), prev: p && <Prev now={n.adr} before={p.adr} decimals={1} /> },
    { k: "rating", label: "Rating", value: fmt(n.rating, 2) },
    { k: "mvps", label: "MVPs", value: n.mvps },
    { k: "first_kills", label: "Aperturas", value: n.first_kills },
    { k: "k4", label: "4K", value: n.k4 },
  ]
  const maps = [...r.maps].sort((a, b) => b.matches - a.matches)
  const maxPlays = maps[0]?.matches ?? 1
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Reveal step={0} className="flex flex-wrap items-center gap-4">
          <PlayerAvatar alias={r.player.nick} photo={r.player.photo} className="size-14 text-xl ring-2 ring-primary/50" />
          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-xs font-semibold tracking-[1.5px] text-primary uppercase">
              Recap · {r.season.name}
            </span>
            <h2 className="truncate text-[clamp(26px,4vw,40px)] leading-tight font-bold tracking-[-1px]">
              {r.player.nick}
            </h2>
            <span className="text-sm text-muted-foreground">
              Del {dateLabel(r.season.starts_at)} al {dateLabel(r.season.closed_at)} · {r.season.players} jugadores en la temporada
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={onReplay}>
              <RotateCcwIcon /> <span className="hidden sm:inline">Ver la historia</span>
            </Button>
            <CopyLink />
            <SaveMenu rootRef={rootRef} />
            <Button variant="ghost" size="icon" aria-label="Cerrar el recap" onClick={onClose} className="rounded-full">
              <XIcon />
            </Button>
          </div>
        </Reveal>

        {marks.length > 0 && (
          <Reveal step={0.5} className="flex flex-wrap gap-2">
            {marks.map((k) => (
              <S key={k} k={k} className="rounded-full">
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 text-sm font-medium text-amber-300">
                  <TrophyIcon className="size-3.5" /> Top {Math.max(1, 100 - r.compare[k].pct)}% en {statLabel(k).split(" (")[0]}
                </span>
              </S>
            ))}
          </Reveal>
        )}

        <div className="grid gap-3 lg:grid-cols-[minmax(300px,1fr)_2fr]">
          <Reveal step={1}>
            <Card variant="outline" radius="xl" className={cn("flex h-full flex-col items-center justify-center gap-3 p-6 text-center", glass)}>
              {medalTpl ? (
                <span data-export-medal>
                  <Medal look={defaultLook(medalTpl)} size={104} title={r.final.medal!.name} />
                </span>
              ) : (
                <LevelBadge level={r.final.level} size={60} />
              )}
              {r.final.eligible && r.final.rank !== null ? (
                <>
                  <span className="font-mono text-6xl leading-none font-semibold tracking-[-2px] tabular-nums">
                    #{r.final.rank}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Puesto final de {r.final.total_ranked}
                    {r.final.medal && ` · ${r.final.medal.name}`}
                  </span>
                  {p?.rank && (
                    <Prev now={-r.final.rank} before={-p.rank} suffix=" puestos" />
                  )}
                </>
              ) : (
                <>
                  <span className="text-2xl font-semibold">No clasificó</span>
                  <span className="text-sm text-muted-foreground">No llegó al mínimo de mixes</span>
                </>
              )}
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                Nivel final <LevelBadge level={r.final.level} size={24} />
              </span>
            </Card>
          </Reveal>

          <Reveal step={2}>
            <Card variant="outline" radius="xl" className={cn("flex h-full flex-col gap-3 p-5", glass)}>
              <SectionTitle
                aside={
                  <S k="elo_delta" className="rounded-md">
                    <span className={cn("font-mono text-lg font-semibold tabular-nums", delta >= 0 ? "text-win" : "text-destructive")}>
                      {signed(delta)}
                    </span>
                  </S>
                }
              >
                Evolución de ELO
              </SectionTitle>
              <Elo className="mt-8 min-h-[200px] flex-1" />
              <dl className="grid grid-cols-3 gap-2">
                <Kv label="Empezó">{fmt(r.elo.start)}</Kv>
                <Kv label="Pico">{fmt(r.elo.peak)}</Kv>
                <Kv label="Terminó">{fmt(r.elo.end)}</Kv>
              </dl>
            </Card>
          </Reveal>
        </div>

        <Reveal step={3} className="flex flex-col gap-3">
          <SectionTitle aside={<span className="text-xs text-muted-foreground">Pasá el mouse para ver el promedio de todos</span>}>
            Números
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {tiles.map((t, k) => (
              <Reveal key={t.k} step={4 + k * 0.35}>
                <S k={t.k} className="h-full">
                  <StatTile label={t.label} value={t.value} valueClassName={t.tone} className={cn("h-full", glass)}>
                    {t.prev}
                  </StatTile>
                </S>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <div className="grid gap-3 lg:grid-cols-3">
          <Reveal step={10}>
            <Card variant="outline" radius="xl" className={cn("flex h-full flex-col gap-3 p-5", glass)}>
              <SectionTitle aside={<span className="text-xs text-muted-foreground">mixes · victorias</span>}>Mapas</SectionTitle>
              <ul className="flex flex-col gap-1">
                {maps.map((mp) => {
                  const pct = Math.round((mp.wins / mp.matches) * 100)
                  return (
                    <li key={mp.name}>
                      <Hint
                        text={`${mp.wins} ganados y ${mp.matches - mp.wins} perdidos · K/D ${fmt(mp.kd, 2)}`}
                        className="grid grid-cols-[90px_1fr_auto] items-center gap-3 px-2 py-1.5 hover:bg-white/[0.05]"
                      >
                        <span className="truncate text-sm font-medium capitalize">{mapLabel(mp.name)}</span>
                        <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full bg-primary/80" style={{ width: `${(mp.matches / maxPlays) * 100}%` }} />
                        </span>
                        <span className="w-[72px] text-right font-mono text-xs tabular-nums">
                          {mp.matches} · <span className={pct >= 50 ? "text-win" : "text-destructive"}>{pct}%</span>
                        </span>
                      </Hint>
                    </li>
                  )
                })}
              </ul>
            </Card>
          </Reveal>

          <Reveal step={11}>
            <Card variant="outline" radius="xl" className={cn("relative isolate flex h-full flex-col gap-3 overflow-hidden p-5", glass)}>
              <SectionTitle>Arma favorita</SectionTitle>
              {r.weapon ? (
                <>
                  <span className="text-4xl font-bold tracking-[-1px]">{WEAPONS[r.weapon.name] ?? r.weapon.name}</span>
                  <span className="text-sm text-muted-foreground">El {r.weapon.share_pct}% de tus kills</span>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${r.weapon.share_pct}%` }} />
                  </div>
                  <dl className="mt-auto grid grid-cols-2 gap-2">
                    <Kv label="Kills">{fmt(r.weapon.kills)}</Kv>
                    <Hint text={`Tu % de HS general fue ${n.hs_pct}%`}>
                      <Kv label="% HS">{r.weapon.hs_pct}%</Kv>
                    </Hint>
                  </dl>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tus partidas de esta temporada no tienen el registro de kills, así que no sabemos cuál fue.
                </p>
              )}
            </Card>
          </Reveal>

          <Reveal step={12}>
            <Card variant="outline" radius="xl" className={cn("relative isolate flex h-full flex-col gap-3 overflow-hidden p-5", glass)}>
              <Radar map={m.map} className="w-[140%] opacity-[0.08]" />
              <SectionTitle>Mejor partida</SectionTitle>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{dateLabel(m.date)}</span>
                <span className="text-2xl font-semibold capitalize">{mapLabel(m.map)}</span>
                <span className={cn("font-mono font-semibold tabular-nums", m.won ? "text-win" : "text-destructive")}>
                  {m.score[0]}–{m.score[1]} {m.won ? "ganado" : "perdido"}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <MiniKv label="K/D">{m.kills}/{m.deaths}</MiniKv>
                <Hint text={`Tu ADR de la temporada: ${fmt(n.adr, 1)} · promedio de todos: ${fmt(r.compare.adr.avg, 1)}`}>
                  <MiniKv label="ADR">{fmt(m.adr, 0)}</MiniKv>
                </Hint>
                <Hint text={`Tu rating de la temporada: ${fmt(n.rating, 2)} · promedio de todos: ${fmt(r.compare.rating.avg, 2)}`}>
                  <MiniKv label="Rating">{fmt(m.rating, 2)}</MiniKv>
                </Hint>
              </dl>
              <a href="#" onClick={(e) => e.preventDefault()} className="mt-auto text-sm font-medium text-primary underline-offset-4 hover:underline">
                Ver el mix →
              </a>
            </Card>
          </Reveal>
        </div>

        {r.clips.length > 0 && (
          <Reveal step={12.5}>
            <Card variant="outline" radius="xl" className={cn("flex flex-col gap-4 p-5 [--accent:var(--primary)]", glass)}>
              <SectionTitle aside={<span className="text-xs text-muted-foreground">No entran en la imagen ni en el PDF</span>}>
                Tus mejores jugadas
              </SectionTitle>
              <FullClips clips={r.clips} />
            </Card>
          </Reveal>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Reveal step={13}>
            <Card variant="outline" radius="xl" className={cn("flex h-full flex-col gap-2 p-5", glass)}>
              <SectionTitle>Compañeros</SectionTitle>
              <PersonLine p={r.mates.most_played} lines={personLines.mate(r.mates.most_played)} tag="Más fiel" note={`${r.mates.most_played.together} mixes juntos`} />
              <PersonLine
                p={r.mates.most_wins}
                lines={personLines.mate(r.mates.most_wins)}
                tag="Dupla ganadora"
                note={`${r.mates.most_wins.won} de ${r.mates.most_wins.together} ganados`}
              />
            </Card>
          </Reveal>

          <Reveal step={14}>
            <Card variant="outline" radius="xl" className={cn("flex h-full flex-col gap-2 p-5", glass)}>
              <SectionTitle>Rivales</SectionTitle>
              {r.rivals.victim && r.rivals.nemesis ? (
                <>
                  <PersonLine p={r.rivals.victim} lines={personLines.rival(r.rivals.victim)} tag="Víctima" note={`Lo bajaste ${r.rivals.victim.you_killed} veces`} />
                  <PersonLine p={r.rivals.nemesis} lines={personLines.rival(r.rivals.nemesis)} tag="Némesis" note={`Te bajó ${r.rivals.nemesis.killed_you} veces`} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tus partidas de esta temporada no tienen el registro de kills, así que no hay rivales para mostrar.
                </p>
              )}
            </Card>
          </Reveal>
        </div>

        <Reveal step={15} className="flex justify-center pb-4">
          <Button asChild variant="ghost">
            <Link to="/player/$nick" params={{ nick: r.player.nick }}>
              Ir a mi perfil <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
      </div>
    </div>
  )
}

/** Guardar la vista completa como imagen o PDF (sin los clips). */
function SaveMenu({ rootRef }: { rootRef: RefObject<HTMLDivElement | null> }) {
  const { r, d } = useRecap()
  const [busy, setBusy] = useState(false)
  const name = `recap-${r.season.name.toLowerCase().replace(/\s+/g, "-")}-${r.player.nick.toLowerCase()}`
  const save = async (kind: "jpeg" | "pdf") => {
    if (!rootRef.current) return
    setBusy(true)
    try {
      const canvas = await renderRecap(r, d, rootRef.current)
      await (kind === "jpeg" ? saveJpeg(canvas, name) : savePdf(canvas, name))
      toast.success(kind === "jpeg" ? "Imagen guardada" : "PDF guardado")
    } catch {
      toast.error("No se pudo generar el archivo")
    } finally {
      setBusy(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {busy ? <LoaderIcon className="animate-spin" /> : <DownloadIcon />}
          <span className="hidden sm:inline">Guardar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => void save("jpeg")}>
          <ImageIcon /> Imagen (JPEG)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void save("pdf")}>
          <FileTextIcon /> PDF
        </DropdownMenuItem>
        <p className="px-2 py-1.5 text-[11.5px] text-muted-foreground">Todo el recap menos los clips.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MiniKv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  )
}

function PersonLine({ p, lines, note, tag }: { p: RecapPlayer; lines: [string, string][]; note: string; tag: string }) {
  return (
    <PersonLink p={p} lines={lines} className="-mx-2 flex items-center gap-3 px-2 py-2">
      <PlayerAvatar alias={p.nick} photo={p.photo} className="size-10" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-medium text-primary">{tag}</span>
        <span className="truncate font-semibold">{p.nick}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </span>
      <LevelBadge level={p.level} size={24} />
      <ChevronRightIcon className="size-4 text-muted-foreground" />
    </PersonLink>
  )
}
