import { cn } from "cn"
import {
  BombIcon,
  EyeOffIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SkullIcon,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { Segmented } from "@/components/brand/Segmented"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { SIDE_FILL, SIDE_LABEL, toRadar, type RadarInfo } from "../lib/radar"
import {
  blindAt,
  bombAt,
  burstEnd,
  END_REASON,
  hitsAt,
  positionsAt,
  roundSpan,
  smokeOpacity,
  type NadeKind,
  type Side,
  type Track,
  type TrackNadeFlight,
  type TrackPlayer,
  type TrackPos,
  type TrackRound,
} from "../lib/track"
import { RadarStage } from "./RadarStage"

const SPEEDS = [1, 2, 4, 8] as const
// Radio del humo en unidades del juego (el radar va en las mismas unidades).
const SMOKE_RADIUS = 140
// Segundos de estela detrás de cada jugador.
const TRAIL = 2.5
const DEFUSE_SECONDS = { kit: 5, sin: 10 }

const NADE_FILL: Record<NadeKind, string> = {
  he: "#ff7a1a",
  flash: "#ffffff",
  smoke: "#c9ccd3",
}
const NADE_NAME: Record<NadeKind, string> = {
  he: "HE",
  flash: "Flash",
  smoke: "Humo",
}

const hpColor = (hp: number) =>
  hp > 50 ? "#3fb950" : hp > 20 ? "#e3b341" : "#ff4d4f"

const clock = (s: number) => {
  const v = Math.max(0, Math.floor(s))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`
}

/** Repetición 2D: el radar con los jugadores moviéndose, ronda por ronda. */
export function RoundReplay({
  track,
  radar,
  className,
}: {
  track: Track
  radar: RadarInfo
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const round = track.rounds[index]
  if (!round)
    return (
      <p className="text-sm text-muted-foreground">
        La partida no tiene rondas grabadas.
      </p>
    )
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <RoundPicker rounds={track.rounds} index={index} onPick={setIndex} />
      {/* key: cada ronda arranca de cero (tiempo, pausa, a quién se sigue). */}
      <RoundPlayer
        key={round.n}
        map={track.map}
        round={round}
        radar={radar}
        onPrev={index > 0 ? () => setIndex(index - 1) : undefined}
        onNext={
          index < track.rounds.length - 1
            ? () => setIndex(index + 1)
            : undefined
        }
      />
    </div>
  )
}

function RoundPicker({
  rounds,
  index,
  onPick,
}: {
  rounds: TrackRound[]
  index: number
  onPick: (i: number) => void
}) {
  return (
    <div role="tablist" aria-label="Rondas" className="flex flex-wrap gap-1">
      {rounds.map((r, i) => (
        <button
          key={r.n}
          type="button"
          role="tab"
          aria-selected={i === index}
          aria-label={`Ronda ${r.n}${r.winner ? `, ganan los ${SIDE_LABEL[r.winner]}` : ""}`}
          onClick={() => onPick(i)}
          className={cn(
            "flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 font-mono text-xs tabular-nums transition-colors",
            i === index
              ? "border-foreground bg-foreground text-background"
              : "bg-card text-muted-foreground hover:text-foreground"
          )}
          style={
            i === index || !r.winner
              ? undefined
              : { boxShadow: `inset 0 -2px 0 ${SIDE_FILL[r.winner]}` }
          }
        >
          {r.n}
        </button>
      ))}
    </div>
  )
}

function RoundPlayer({
  map,
  round,
  radar,
  onPrev,
  onNext,
}: {
  map: string
  round: TrackRound
  radar: RadarInfo
  onPrev?: () => void
  onNext?: () => void
}) {
  const [from, to] = roundSpan(round)
  const start = round.freezeEnd ?? from
  // Arranca al final del tiempo de compra: antes no pasa nada.
  const [t, setT] = useState(start)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2)
  const [focus, setFocus] = useState<number | null>(null)
  const last = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const step = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000
      last.current = now
      setT((v) => {
        const nv = v + dt * speed
        if (nv >= to) {
          setPlaying(false)
          return to
        }
        return nv
      })
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      last.current = null
    }
  }, [playing, speed, to])

  const toggle = () => {
    if (!playing && t >= to) setT(start)
    setPlaying((p) => !p)
  }
  const follow = (slot: number) => setFocus((f) => (f === slot ? null : slot))

  // Atajos: espacio (play), flechas (5 s), coma y punto (ronda), 1 a 4 (velocidad).
  const keys = useRef({ toggle, onPrev, onNext, from, to })
  useEffect(() => {
    keys.current = { toggle, onPrev, onNext, from, to }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (
        el?.closest("input, select, textarea, [contenteditable=true]") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return
      const k = keys.current
      if (e.key === " ") {
        e.preventDefault()
        k.toggle()
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault()
        const d = e.key === "ArrowRight" ? 5 : -5
        setT((v) => Math.min(k.to, Math.max(k.from, v + d)))
      } else if (e.key === ",") k.onPrev?.()
      else if (e.key === ".") k.onNext?.()
      else if (/^[1-4]$/.test(e.key)) setSpeed(SPEEDS[Number(e.key) - 1])
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const ps = useMemo(() => positionsAt(round, t), [round, t])
  const kills = round.kills.filter((k) => k.t <= t)
  const dead = new Set(kills.map((k) => k.victim.slot))
  const alive = ps.filter((p) => !dead.has(p.slot))
  const bomb = bombAt(round, t)
  const ended = round.end !== null && t >= round.end
  const blind = blindAt(round, t)
  const bursts = round.bursts.filter((b) => b.t <= t && t < burstEnd(b))
  const flights = round.flights.filter(
    (f) => f.points[0].t <= t && t <= (f.points.at(-1)?.t ?? 0) + 0.05
  )
  const hits = hitsAt(round, t)
  const defuse = round.defuses.find(
    (d) => d.t <= t && (d.until === null || t < d.until)
  )
  const trails = useMemo(() => {
    const out = new Map<number, { x: number; y: number }[]>()
    for (const f of round.frames) {
      if (f.t < t - TRAIL || f.t > t) continue
      for (const p of f.ps) {
        const list = out.get(p.slot) ?? []
        list.push(p)
        out.set(p.slot, list)
      }
    }
    return out
  }, [round, t])

  const sideCount = (side: Side) =>
    alive.filter((p) => round.players[p.slot]?.side === side).length
  // Reloj como en el juego: lo que queda de la ronda (o lo que pasó, si el .trk no trae la duración).
  const roundClock =
    round.roundTime !== null
      ? round.roundTime - Math.max(0, t - start)
      : t - start

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-3 font-mono tabular-nums">
            <AliveCount side={3} n={sideCount(3)} />
            <span className="text-muted-foreground">vs</span>
            <AliveCount side={2} n={sideCount(2)} />
          </div>
          {bomb && bomb.state === "ticking" ? (
            <span className="flex items-center gap-1.5 font-mono font-semibold text-[#e5484d] tabular-nums">
              <BombIcon className="size-4" aria-hidden />
              {bomb.left.toFixed(1)} s
            </span>
          ) : (
            <span className="font-mono text-muted-foreground tabular-nums">
              {t < start ? "Compra" : clock(roundClock)}
            </span>
          )}
        </div>
        <RadarStage
          map={map}
          radar={radar}
          label={`Radar de ${map}, ronda ${round.n}, ${clock(t - start)}`}
        >
          {(s) => (
            <>
              {/* Estelas: por dónde vino cada uno en los últimos segundos. */}
              {[...trails].map(([slot, pts]) => {
                const who = round.players[slot]
                if (!who || dead.has(slot) || pts.length < 2) return null
                return (
                  <polyline
                    key={`t${slot}`}
                    points={pts
                      .map((p) => {
                        const r = toRadar(radar, p.x, p.y)
                        return `${r.px},${r.py}`
                      })
                      .join(" ")}
                    fill="none"
                    stroke={SIDE_FILL[who.side]}
                    strokeWidth={3 * s}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={focus === null || focus === slot ? 0.35 : 0.1}
                  />
                )
              })}
              {/* El humo tapa el piso, no a los jugadores. */}
              {bursts
                .filter((b) => b.kind === "smoke")
                .map((b, i) => {
                  const p = toRadar(radar, b.x, b.y)
                  const fade = smokeOpacity(b, t)
                  const grow = Math.min(1, t - b.t + 0.25)
                  return (
                    <g key={`s${i}`}>
                      <title>{`Humo${b.thrower ? ` de ${b.thrower.name}` : ""}`}</title>
                      <circle
                        cx={p.px}
                        cy={p.py}
                        r={SMOKE_RADIUS * grow}
                        fill="#c9ccd3"
                        opacity={0.68 * fade}
                      />
                      <circle
                        cx={p.px}
                        cy={p.py}
                        r={SMOKE_RADIUS * grow * 0.6}
                        fill="#e4e6ea"
                        opacity={0.35 * fade}
                      />
                    </g>
                  )
                })}
              {bomb && <BombMark bomb={bomb} radar={radar} s={s} />}
              {kills.map((k, i) => {
                const p = toRadar(radar, k.at.x, k.at.y)
                return (
                  <g
                    key={`k${i}`}
                    transform={`translate(${p.px} ${p.py})`}
                    opacity={0.85}
                  >
                    <title>{`${k.victim.name} murió${k.killer ? ` (${k.killer.name}, ${k.weapon})` : ""}`}</title>
                    <path
                      d={`M${-9 * s} ${-9 * s}L${9 * s} ${9 * s}M${9 * s} ${-9 * s}L${-9 * s} ${9 * s}`}
                      stroke={SIDE_FILL[k.victim.side]}
                      strokeWidth={3.5 * s}
                      strokeLinecap="round"
                    />
                  </g>
                )
              })}
              {bursts
                .filter((b) => b.kind !== "smoke")
                .map((b, i) => {
                  const p = toRadar(radar, b.x, b.y)
                  const k = (t - b.t) / (burstEnd(b) - b.t)
                  const r = (30 + 150 * k) * Math.max(1, s / 3)
                  return b.kind === "he" ? (
                    <g key={`h${i}`}>
                      <circle
                        cx={p.px}
                        cy={p.py}
                        r={r}
                        fill="#ff7a1a"
                        opacity={0.25 * (1 - k)}
                      />
                      <circle
                        cx={p.px}
                        cy={p.py}
                        r={r}
                        fill="none"
                        stroke="#ff7a1a"
                        strokeWidth={5 * s}
                        opacity={1 - k}
                      />
                    </g>
                  ) : (
                    <circle
                      key={`f${i}`}
                      cx={p.px}
                      cy={p.py}
                      r={r + 20}
                      fill="#fff"
                      opacity={0.9 * (1 - k)}
                    />
                  )
                })}
              {flights.map((f, i) => (
                <NadeInAir key={`n${i}`} flight={f} t={t} radar={radar} s={s} />
              ))}
              {defuse && (
                <DefuseRing
                  pos={ps.find((p) => p.slot === defuse.player.slot)}
                  progress={
                    (t - defuse.t) /
                    (defuse.kit ? DEFUSE_SECONDS.kit : DEFUSE_SECONDS.sin)
                  }
                  kit={defuse.kit}
                  radar={radar}
                  s={s}
                />
              )}
              {alive.map((p) => {
                const who = round.players[p.slot]
                if (!who) return null
                return (
                  <PlayerDot
                    key={p.slot}
                    p={p}
                    who={who}
                    radar={radar}
                    s={s}
                    blind={blind.get(p.slot)}
                    hit={hits.some((h) => h.victim.slot === p.slot)}
                    dim={focus !== null && focus !== p.slot}
                    focused={focus === p.slot}
                    onClick={() => follow(p.slot)}
                  />
                )
              })}
              {/* El daño de cada golpe sube y se apaga sobre el que lo recibió. */}
              {hits.map((h, i) => {
                const at =
                  ps.find((p) => p.slot === h.victim.slot) ??
                  round.kills.find((k) => k.victim.slot === h.victim.slot)?.at
                if (!at) return null
                const r = toRadar(radar, at.x, at.y)
                const k = (t - h.t) / 0.8
                return (
                  <text
                    key={`d${i}`}
                    x={r.px + 16 * s}
                    y={r.py - (10 + 24 * k) * s}
                    fontSize={(h.hitgroup === 1 ? 15 : 13) * s}
                    fontWeight={700}
                    fill={h.hitgroup === 1 ? "#ff4d4f" : "#ffd166"}
                    stroke="#000"
                    strokeWidth={3 * s}
                    paintOrder="stroke"
                    opacity={1 - k}
                  >
                    -{h.dmg}
                    {h.hitgroup === 1 ? " HS" : ""}
                  </text>
                )
              })}
            </>
          )}
        </RadarStage>
        <div className="flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Ronda anterior"
            disabled={!onPrev}
            onClick={onPrev}
          >
            <SkipBackIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label={playing ? "Pausa" : "Reproducir"}
            onClick={toggle}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Ronda siguiente"
            disabled={!onNext}
            onClick={onNext}
          >
            <SkipForwardIcon />
          </Button>
          <span className="w-10 font-mono text-xs text-muted-foreground tabular-nums">
            {clock(t - start)}
          </span>
          <div className="relative flex-1">
            <Slider
              aria-label="Momento de la ronda"
              min={from}
              max={to}
              step={0.1}
              value={[t]}
              onValueChange={([v]) => setT(v)}
            />
            <Timeline round={round} from={from} to={to} />
          </div>
          <Segmented
            label="Velocidad"
            size="sm"
            value={speed}
            onChange={setSpeed}
            options={SPEEDS.map((v) => ({ value: v, label: `${v}×` }))}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Toca un jugador para seguirlo. Teclas: espacio (reproducir), ← → (5
          s), , y . (ronda), 1 a 4 (velocidad).
        </p>
      </div>

      <aside className="flex flex-col gap-2 text-sm">
        <div className="rounded-xl border bg-card p-3">
          <p className="font-semibold">Ronda {round.n}</p>
          <p className="text-xs text-muted-foreground">
            {ended && round.winner
              ? `Ganan los ${SIDE_LABEL[round.winner]}${round.reason !== null && END_REASON[round.reason] ? ` · ${END_REASON[round.reason]}` : ""}`
              : "En juego"}
          </p>
          {ended && onNext && (
            <Button
              size="xs"
              variant="outline"
              className="mt-2"
              onClick={onNext}
            >
              Siguiente ronda
            </Button>
          )}
        </div>
        <Scoreboard
          round={round}
          t={t}
          ps={ps}
          dead={dead}
          blind={blind}
          focus={focus}
          onFocus={follow}
        />
        <Feed round={round} t={t} start={start} />
      </aside>
    </div>
  )
}

function AliveCount({ side, n }: { side: Side; n: number }) {
  return (
    <span
      className="flex items-center gap-1.5"
      aria-label={`${n} ${SIDE_LABEL[side]} vivos`}
    >
      <span
        className="size-2.5 rounded-full"
        style={{ background: SIDE_FILL[side] }}
        aria-hidden
      />
      <span className="font-semibold">{SIDE_LABEL[side]}</span>
      <span>{n}</span>
    </span>
  )
}

/** Marcas de la línea de tiempo: kills (del color del que murió) y el C4 (plantado, desactivado, explotado). */
function Timeline({
  round,
  from,
  to,
}: {
  round: TrackRound
  from: number
  to: number
}) {
  const at = (x: number) => `${((x - from) / (to - from || 1)) * 100}%`
  return (
    <div className="pointer-events-none absolute inset-x-0 -bottom-2.5 h-2">
      {round.kills.map((k, i) => (
        <span
          key={`k${i}`}
          className="absolute h-1.5 w-0.5 rounded-full"
          style={{ left: at(k.t), background: SIDE_FILL[k.victim.side] }}
        />
      ))}
      {round.bomb.map((b, i) => (
        <span
          key={`b${i}`}
          aria-label={
            b.kind === "plant"
              ? "Plantan el C4"
              : b.kind === "defuse"
                ? "Desactivan el C4"
                : "Explota el C4"
          }
          className="absolute -top-0.5 size-2.5 -translate-x-1/2 rounded-[3px] ring-1 ring-black/60"
          style={{
            left: at(b.t),
            background:
              b.kind === "plant"
                ? "#e5484d"
                : b.kind === "defuse"
                  ? SIDE_FILL[3]
                  : "#ff7a1a",
          }}
        />
      ))}
    </div>
  )
}

function PlayerDot({
  p,
  who,
  radar,
  s,
  blind,
  hit,
  dim,
  focused,
  onClick,
}: {
  p: TrackPos
  who: TrackPlayer
  radar: RadarInfo
  s: number
  blind?: { left: number; secs: number }
  hit: boolean
  dim: boolean
  focused: boolean
  onClick: () => void
}) {
  const { px, py } = toRadar(radar, p.x, p.y)
  const a = (-p.yaw * Math.PI) / 180
  const fill = SIDE_FILL[who.side]
  // Como en el juego: blanco del todo y se va en el último segundo y medio.
  const white = blind ? Math.min(1, blind.left / Math.min(1.5, blind.secs)) : 0
  const r = (focused ? 15 : 12) * s
  const hp = Math.max(0, Math.min(100, p.hp))
  return (
    <g
      transform={`translate(${px} ${py})`}
      opacity={dim ? 0.35 : 1}
      onClick={onClick}
      className="cursor-pointer"
    >
      <title>{`${who.name} · ${p.hp} HP${p.weapon ? ` · ${p.weapon}` : ""}${blind ? ` · cegado ${blind.left.toFixed(1)} s` : ""}`}</title>
      {hit && <circle r={r + 7 * s} fill="#ff4d4f" opacity={0.45} />}
      <line
        x1={0}
        y1={0}
        x2={Math.cos(a) * 28 * s}
        y2={Math.sin(a) * 28 * s}
        stroke={fill}
        strokeWidth={3 * s}
        strokeLinecap="round"
        opacity={0.85}
      />
      <circle
        r={r}
        fill={fill}
        stroke={p.bomb ? "#e5484d" : focused ? "#fff" : "#111"}
        strokeWidth={(p.bomb || focused ? 4 : 2) * s}
      />
      {white > 0 && <circle r={r} fill="#fff" opacity={0.75 * white} />}
      {/* Vida: la barrita debajo del punto. */}
      <rect
        x={-15 * s}
        y={r + 4 * s}
        width={30 * s}
        height={4 * s}
        rx={2 * s}
        fill="#000"
        opacity={0.6}
      />
      <rect
        x={-15 * s}
        y={r + 4 * s}
        width={(30 * s * hp) / 100}
        height={4 * s}
        rx={2 * s}
        fill={hpColor(hp)}
      />
      <text
        y={-r - 6 * s}
        textAnchor="middle"
        fontSize={14 * s}
        fontWeight={600}
        fill="#fff"
        stroke="#000"
        strokeWidth={3 * s}
        paintOrder="stroke"
      >
        {who.name.slice(0, 12)}
      </text>
      {p.weapon && (
        <text
          y={r + 20 * s}
          textAnchor="middle"
          fontSize={11 * s}
          fill="#d0d3da"
          stroke="#000"
          strokeWidth={2.5 * s}
          paintOrder="stroke"
        >
          {p.weapon}
        </text>
      )}
      {blind && <BlindEye y={-r - 34 * s} s={s} opacity={white} />}
    </g>
  )
}

/** El ojo blanco sobre el cegado: lleno mientras no ve y se desvanece al recuperarse. */
function BlindEye({
  y,
  s,
  opacity,
}: {
  y: number
  s: number
  opacity: number
}) {
  const w = 16 * s
  const h = 9 * s
  return (
    <g
      transform={`translate(0 ${y})`}
      opacity={Math.max(0.15, opacity)}
      aria-hidden
    >
      <path
        d={`M${-w} 0 Q0 ${-h * 2} ${w} 0 Q0 ${h * 2} ${-w} 0Z`}
        fill="#fff"
        stroke="#000"
        strokeWidth={2.5 * s}
      />
      <circle r={4.5 * s} fill="#000" />
      <circle r={1.8 * s} cx={1.5 * s} cy={-1.5 * s} fill="#fff" />
    </g>
  )
}

/** El C4 plantado: titila en rojo cada vez más rápido, con la cuenta regresiva arriba. */
function BombMark({
  bomb,
  radar,
  s,
}: {
  bomb: NonNullable<ReturnType<typeof bombAt>>
  radar: RadarInfo
  s: number
}) {
  const { px, py } = toRadar(radar, bomb.x, bomb.y)
  const ticking = bomb.state === "ticking"
  // El pitido del C4 se acelera: de uno por segundo a casi seguido al final.
  const period = 0.12 + 0.88 * (bomb.left / bomb.timer)
  const on = ticking && (bomb.timer - bomb.left) % period < period * 0.4
  const color =
    bomb.state === "defuse"
      ? SIDE_FILL[3]
      : bomb.state === "explode"
        ? "#ff7a1a"
        : "#a8282b"
  return (
    <g transform={`translate(${px} ${py})`}>
      <title>
        {bomb.state === "defuse"
          ? "Desactivaron el C4"
          : bomb.state === "explode"
            ? "Explotó el C4"
            : `C4 plantado: ${bomb.left.toFixed(1)} s`}
      </title>
      {bomb.state === "explode" && (
        <circle r={110 * s} fill="#ff7a1a" opacity={0.18} />
      )}
      {on && <circle r={22 * s} fill="#ff2020" opacity={0.55} />}
      <rect
        x={-10 * s}
        y={-7 * s}
        width={20 * s}
        height={14 * s}
        rx={2.5 * s}
        fill={on ? "#ff2020" : color}
        stroke="#111"
        strokeWidth={2 * s}
      />
      <rect
        x={-6 * s}
        y={-3 * s}
        width={12 * s}
        height={6 * s}
        rx={1 * s}
        fill="#111"
        opacity={0.7}
      />
      {ticking && (
        <text
          y={-14 * s}
          textAnchor="middle"
          fontSize={13 * s}
          fontWeight={700}
          fill="#ff4d4f"
          stroke="#000"
          strokeWidth={3 * s}
          paintOrder="stroke"
        >
          {Math.ceil(bomb.left)}
        </text>
      )}
    </g>
  )
}

/** El anillo que se llena mientras un CT desactiva (5 s con kit, 10 sin). */
function DefuseRing({
  pos,
  progress,
  kit,
  radar,
  s,
}: {
  pos?: TrackPos
  progress: number
  kit: boolean
  radar: RadarInfo
  s: number
}) {
  if (!pos) return null
  const { px, py } = toRadar(radar, pos.x, pos.y)
  const r = 24 * s
  const c = 2 * Math.PI * r
  const k = Math.min(1, Math.max(0, progress))
  return (
    <g transform={`translate(${px} ${py})`}>
      <title>{`Desactivando ${kit ? "con kit" : "sin kit"}: ${Math.round(k * 100)} %`}</title>
      <circle
        r={r}
        fill="none"
        stroke="#000"
        strokeWidth={6 * s}
        opacity={0.5}
      />
      <circle
        r={r}
        fill="none"
        stroke={SIDE_FILL[3]}
        strokeWidth={5 * s}
        strokeDasharray={`${c * k} ${c}`}
        transform="rotate(-90)"
        strokeLinecap="round"
      />
    </g>
  )
}

/** Una granada en el aire: el tiro hasta ahora y la granada, interpolada entre sus puntos. */
function NadeInAir({
  flight,
  t,
  radar,
  s,
}: {
  flight: TrackNadeFlight
  t: number
  radar: RadarInfo
  s: number
}) {
  const pts = flight.points
  let i = pts.findIndex((p) => p.t > t)
  if (i === -1) i = pts.length
  const done = pts.slice(0, i)
  const a = done.at(-1) ?? pts[0]
  const b = pts[i] ?? a
  const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0
  const now = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
  const path = [...done, now]
    .map((p, j) => {
      const r = toRadar(radar, p.x, p.y)
      return `${j ? "L" : "M"}${r.px} ${r.py}`
    })
    .join("")
  const head = toRadar(radar, now.x, now.y)
  const side = flight.thrower?.side
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={side ? SIDE_FILL[side] : "#fff"}
        strokeWidth={2 * s}
        strokeDasharray={`${5 * s} ${4 * s}`}
        opacity={0.85}
      />
      <circle
        cx={head.px}
        cy={head.py}
        r={6 * s}
        fill={NADE_FILL[flight.kind]}
        stroke="#111"
        strokeWidth={1.5 * s}
      >
        <title>{`${NADE_NAME[flight.kind]}${flight.thrower ? ` de ${flight.thrower.name}` : ""}`}</title>
      </circle>
    </g>
  )
}

/** Los jugadores de cada lado: vida, arma, plata al empezar y daño hecho. Tocar uno lo sigue. */
function Scoreboard({
  round,
  t,
  ps,
  dead,
  blind,
  focus,
  onFocus,
}: {
  round: TrackRound
  t: number
  ps: TrackPos[]
  dead: Set<number>
  blind: Map<number, { left: number; secs: number }>
  focus: number | null
  onFocus: (slot: number) => void
}) {
  const now = new Map(ps.map((p) => [p.slot, p]))
  // Daño hecho a rivales en la ronda hasta ahora.
  const dmg = new Map<number, number>()
  for (const h of round.hits)
    if (h.t <= t && h.attacker && h.attacker.side !== h.victim.side)
      dmg.set(h.attacker.slot, (dmg.get(h.attacker.slot) ?? 0) + h.dmg)
  const players = Object.values(round.players).filter(
    (p) => now.has(p.slot) || dead.has(p.slot)
  )
  return (
    <div className="flex flex-col gap-1.5">
      {([3, 2] as const).map((side) => (
        <ul
          key={side}
          aria-label={`Jugadores ${SIDE_LABEL[side]}`}
          className="flex flex-col overflow-hidden rounded-xl border bg-card"
        >
          {players
            .filter((p) => p.side === side)
            .map((p) => {
              const pos = now.get(p.slot)
              const isDead = dead.has(p.slot)
              const hp = isDead ? 0 : (pos?.hp ?? 0)
              return (
                <li key={p.slot}>
                  <button
                    type="button"
                    onClick={() => onFocus(p.slot)}
                    aria-pressed={focus === p.slot}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-muted",
                      focus === p.slot && "bg-muted",
                      isDead && "opacity-45"
                    )}
                  >
                    <span
                      className="h-5 w-1 shrink-0 rounded-full"
                      style={{ background: SIDE_FILL[side] }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 font-medium">
                        {isDead && (
                          <SkullIcon
                            className="size-3 shrink-0"
                            aria-label="Muerto"
                          />
                        )}
                        {pos?.bomb && !isDead && (
                          <BombIcon
                            className="size-3 shrink-0 text-[#e5484d]"
                            aria-label="Lleva la bomba"
                          />
                        )}
                        {blind.has(p.slot) && (
                          <EyeOffIcon
                            className="size-3 shrink-0"
                            aria-label="Cegado"
                          />
                        )}
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${hp}%`, background: hpColor(hp) }}
                        />
                      </span>
                    </span>
                    <span className="w-14 truncate text-right text-muted-foreground">
                      {isDead ? "" : (pos?.weapon ?? "")}
                    </span>
                    <span
                      className="w-11 text-right font-mono text-muted-foreground tabular-nums"
                      title="Plata al empezar la ronda"
                    >
                      {round.money[p.slot] !== undefined
                        ? `$${round.money[p.slot]}`
                        : ""}
                    </span>
                    <span
                      className="w-7 text-right font-mono tabular-nums"
                      title="Daño en la ronda"
                    >
                      {dmg.get(p.slot) ?? 0}
                    </span>
                  </button>
                </li>
              )
            })}
        </ul>
      ))}
    </div>
  )
}

type FeedItem = { t: number; key: string; node: ReactNode }

/** Lo que pasó en la ronda hasta ahora: kills, flashes, HE, el C4 y las desactivaciones. */
function Feed({
  round,
  t,
  start,
}: {
  round: TrackRound
  t: number
  start: number
}) {
  const name = (p: TrackPlayer | null) =>
    p ? (
      <span
        className="truncate font-medium"
        style={{ color: SIDE_FILL[p.side] }}
      >
        {p.name}
      </span>
    ) : (
      <span className="text-muted-foreground">Alguien</span>
    )
  const items: FeedItem[] = []
  round.kills.forEach((k, i) => {
    if (k.t > t) return
    items.push({
      t: k.t,
      key: `k${i}`,
      node: (
        <>
          {k.killer ? (
            name(k.killer)
          ) : (
            <SkullIcon className="size-3.5" aria-label="Se murió solo" />
          )}
          <span className="shrink-0 text-muted-foreground">
            {k.weapon}
            {k.hs ? " · HS" : ""}
          </span>
          {name(k.victim)}
        </>
      ),
    })
  })
  round.bursts.forEach((b, i) => {
    if (b.t > t) return
    if (b.kind === "flash" && b.blinded.length)
      items.push({
        t: b.t,
        key: `f${i}`,
        node: (
          <>
            {name(b.thrower)}
            <span className="text-muted-foreground">
              cegó a{" "}
              {b.blinded
                .map(
                  (x) =>
                    `${x.player.name}${x.player.slot === b.thrower?.slot ? " (a sí mismo)" : x.player.side === b.thrower?.side ? " (compañero)" : ""} ${x.secs.toFixed(1)} s`
                )
                .join(", ")}
            </span>
          </>
        ),
      })
    if (b.kind === "he") {
      // El daño de esta HE: los golpes con hegrenade del que la tiró, apenas explotó.
      const dealt = round.hits.filter(
        (h) =>
          h.weapon === "hegrenade" &&
          h.attacker?.slot === b.thrower?.slot &&
          Math.abs(h.t - b.t) < 0.3
      )
      if (dealt.length)
        items.push({
          t: b.t,
          key: `h${i}`,
          node: (
            <>
              {name(b.thrower)}
              <span className="text-muted-foreground">
                HE: {dealt.reduce((n, h) => n + h.dmg, 0)} de daño a{" "}
                {dealt.length}
              </span>
            </>
          ),
        })
    }
  })
  round.bomb.forEach((b, i) => {
    if (b.t > t) return
    items.push({
      t: b.t,
      key: `b${i}`,
      node: (
        <span className="flex items-center gap-1 font-medium text-[#e5484d]">
          <BombIcon className="size-3.5" aria-hidden />
          {b.kind === "plant"
            ? "Plantaron el C4"
            : b.kind === "defuse"
              ? "Desactivaron el C4"
              : "Explotó el C4"}
        </span>
      ),
    })
  })
  round.defuses.forEach((d, i) => {
    if (d.t > t) return
    const left =
      d.until !== null &&
      d.until <= t &&
      !round.bomb.some(
        (b) => b.kind !== "plant" && Math.abs(b.t - d.until!) < 0.05
      )
    items.push({
      t: d.t,
      key: `d${i}`,
      node: (
        <>
          <ShieldCheckIcon
            className="size-3.5 shrink-0"
            style={{ color: SIDE_FILL[3] }}
            aria-hidden
          />
          {name(d.player)}
          <span className="text-muted-foreground">
            desactiva {d.kit ? "con kit" : "sin kit"}
            {left ? " y la deja" : ""}
          </span>
        </>
      ),
    })
  })
  items.sort((a, b) => a.t - b.t)
  return (
    <ol aria-label="Lo que pasó en la ronda" className="flex flex-col gap-1">
      {items.length === 0 && (
        <li className="text-xs text-muted-foreground">Todavía no pasó nada.</li>
      )}
      {items.map((it) => (
        <li
          key={it.key}
          className="flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1 text-xs"
        >
          <span className="w-8 shrink-0 font-mono text-muted-foreground tabular-nums">
            {clock(it.t - start)}
          </span>
          {it.node}
        </li>
      ))}
    </ol>
  )
}
