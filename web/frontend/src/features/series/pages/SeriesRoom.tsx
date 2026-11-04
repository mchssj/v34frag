import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  PlayIcon,
  XIcon,
} from "lucide-react"
import { BackButton } from "@/components/brand/BackButton"
import { useRef, useState } from "react"

import { TeamCrest } from "@/components/brand/TeamCrest"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { mapsOptions } from "@/features/maps/api/queries"
import { mapImage } from "@/features/maps/lib/catalog"
import { RoomStats } from "@/features/mixes/components/MixRoom"
import { demoMb } from "@/features/mixes/lib/labels"
import { statsRoomFromLines } from "@/features/mixes/lib/room"
import type { StatsTab } from "@/features/mixes/lib/stats"
import { useSeriesClips } from "../api/queries"
import { ServerPanel } from "../components/ServerPanel"
import {
  carouselClips,
  clipKind,
  clipsPending,
  lineups,
  seriesMaps,
  vetoLines,
  type SeriesClip,
  type SeriesDetail,
  type SeriesMap,
} from "../lib/series"

// Página de una serie de torneo o PCW (/match/$id; bitácora 2026-11-01-pagina-serie): cabecera,
// mapas y veto a la izquierda, la partida, las demos y las alineaciones a la derecha, y abajo
// las jugadas destacadas y las estadísticas (todos los mapas o uno).

const fmtLong = (iso: string) =>
  format(parseISO(iso), "EEEE d 'de' MMMM · HH:mm", { locale: es })

const STATE: Record<SeriesDetail["status"], string> = {
  upcoming: "Por jugar",
  live: "En vivo",
  finished: "Terminada",
  cancelled: "Cancelada",
}

export function SeriesRoom({
  match: d,
  me,
  tab,
  onTab,
  map: mapSel,
  onMap,
}: {
  match: SeriesDetail
  me: string | null
  tab?: StatsTab
  onTab?: (tab: StatsTab) => void
  /** Id del juego elegido en las estadísticas; vacío = todos los mapas. */
  map?: string
  onMap?: (gameId: string | undefined) => void
}) {
  const catalog = useQuery(mapsOptions).data
  const maps = seriesMaps(d)
  const withStats = maps.filter((m) => (m.game?.players.length ?? 0) > 0)
  const picked = withStats.find((m) => m.game?.id === mapSel) ?? null
  const names: [string, string] = [teamName(d, 1), teamName(d, 2)]
  const wo = d.end_reason === "walkover"

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton
          fallback={
            d.event
              ? { to: "/events/$id", params: { id: d.event.id } }
              : { to: "/matches", search: { kind: "pcw" } }
          }
          label={d.event?.name ?? "PCW"}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-[30px] gap-1.5 pr-2.5 pl-1.5 text-[13px]"
          )}
        />
        {d.label && (
          <span className="text-[13px] text-muted-foreground">{d.label}</span>
        )}
      </div>

      <Header d={d} />

      {d.status === "cancelled" && (
        <Notice>
          Partida cancelada
          {d.cancel_reason ? ` (${d.cancel_reason})` : ""}.
        </Notice>
      )}
      {wo && <Notice>Se definió por W.O.: no se jugaron mapas.</Notice>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Heading>Mapas</Heading>
          <Card
            variant="outline"
            className="flex flex-col gap-1 px-4 py-3 text-[13px]"
          >
            <span>
              Al mejor de {d.best_of}
              {d.veto ? ` · pool de ${d.veto.pool.length} mapas` : ""}
            </span>
            {d.advantage_side && (
              <span className="text-muted-foreground">
                {names[d.advantage_side - 1]} empezó 1:0 por el mapa de ventaja
                del upper.
              </span>
            )}
          </Card>
          <Veto d={d} />
          {maps.length === 0 && !wo ? (
            <Card
              variant="outline"
              className="px-4 py-6 text-center text-[13px] text-muted-foreground"
            >
              Los mapas salen del veto.
            </Card>
          ) : (
            maps.map((m) => (
              <MapCard
                key={`${m.n}-${m.map}`}
                m={m}
                names={names}
                image={m.map ? mapImage(catalog, m.map) : null}
                selected={!!m.game && m.game.id === picked?.game?.id}
                onPick={
                  (m.game?.players.length ?? 0) > 0
                    ? () =>
                        onMap?.(
                          picked?.game?.id === m.game?.id
                            ? undefined
                            : m.game?.id
                        )
                    : undefined
                }
              />
            ))
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <ServerPanel d={d} names={names} />
          <Info d={d} />
          <Demos maps={maps} />
          <Lineups d={d} />
        </div>
      </div>

      <Clips maps={maps} />

      <div className="flex flex-col gap-3">
        <Heading>Estadísticas</Heading>
        {withStats.length === 0 ? (
          <Card
            variant="outline"
            className="px-4 py-8 text-center text-[13px] text-muted-foreground"
          >
            {d.status === "upcoming"
              ? "Las estadísticas aparecen cuando se juegue el primer mapa."
              : maps.some((m) => m.manual)
                ? "Sin detalle de la partida: el resultado se cargó a mano, sin las stats de los jugadores."
                : "Todavía no hay mapas terminados con estadísticas."}
          </Card>
        ) : (
          <>
            <div
              role="group"
              aria-label="Mapa de las estadísticas"
              className="flex flex-wrap gap-1 self-start rounded-lg bg-muted p-[3px]"
            >
              <MapChip
                active={!picked}
                onClick={() => onMap?.(undefined)}
                label="Todos los mapas"
              />
              {withStats.map((m) => (
                <MapChip
                  key={m.game!.id}
                  active={picked?.game?.id === m.game!.id}
                  onClick={() => onMap?.(m.game!.id)}
                  label={m.map ?? `Mapa ${m.n}`}
                />
              ))}
            </div>
            <RoomStats
              key={picked?.game?.id ?? "all"}
              room={
                picked
                  ? statsRoomFromLines(picked.game!.players, {
                      names,
                      scores: [picked.r1 ?? 0, picked.r2 ?? 0],
                      winner: picked.winner,
                      me,
                    })
                  : statsRoomFromLines(d.series_players, {
                      names,
                      scores: [d.side1.score ?? 0, d.side2.score ?? 0],
                      winner: d.winner_side,
                      me,
                    })
              }
              tab={tab}
              onTab={onTab}
            />
            {!picked &&
              withStats.length < maps.filter((m) => m.r1 != null).length && (
                <p className="text-xs text-muted-foreground">
                  La suma es de los mapas con estadísticas: los cargados a mano
                  no cuentan.
                </p>
              )}
          </>
        )}
      </div>
    </section>
  )
}

const teamName = (d: SeriesDetail, n: 1 | 2) => {
  const s = n === 1 ? d.side1 : d.side2
  return s.team?.name ?? s.name ?? "Por definir"
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border bg-muted px-4 py-3 text-[13px]">
      {children}
    </p>
  )
}

function Header({ d }: { d: SeriesDetail }) {
  const done = d.status === "finished"
  const side = (n: 1 | 2) => {
    const s = n === 1 ? d.side1 : d.side2
    const won = done && d.winner_side === n
    const lost = done && d.winner_side != null && d.winner_side !== n
    return (
      <div
        className={cn(
          "flex min-w-0 flex-col items-center gap-2 text-center",
          lost && "opacity-60"
        )}
      >
        {s.team ? (
          <TeamCrest team={s.team} size="lg" />
        ) : (
          <span className="grid size-12 place-items-center rounded-xl border border-dashed text-muted-foreground">
            ?
          </span>
        )}
        <span className="max-w-full truncate font-semibold">
          {s.team?.name ?? s.name ?? "Por definir"}
        </span>
        {d.status !== "upcoming" && (
          <span
            className={cn(
              "font-mono text-2xl font-bold tabular-nums",
              won ? "text-win" : lost && "text-destructive"
            )}
          >
            {s.score ?? 0}
          </span>
        )}
      </div>
    )
  }
  const when = d.played_at ?? d.starts_at
  return (
    <Card
      variant="outline"
      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-6 sm:px-8"
    >
      {side(1)}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="font-mono text-xl font-bold sm:text-2xl">
          {d.status === "live" ? (
            <span className="inline-flex items-center gap-2 text-destructive">
              <span
                aria-hidden
                className="size-2 animate-live rounded-full bg-current"
              />
              En vivo
            </span>
          ) : (
            STATE[d.status]
          )}
        </span>
        {when && (
          <span className="text-xs text-muted-foreground first-letter:uppercase">
            {fmtLong(when)}
          </span>
        )}
        {d.event && <span className="text-[13px]">{d.event.name}</span>}
        <Badge variant="neutral" shape="soft" size="sm">
          BO{d.best_of}
        </Badge>
      </div>
      {side(2)}
    </Card>
  )
}

function Veto({ d }: { d: SeriesDetail }) {
  const lines = vetoLines(d)
  if (lines.length === 0) return null
  return (
    <Card variant="outline" className="px-4 py-3">
      <ol className="flex list-decimal flex-col gap-0.5 pl-5 text-[13px]">
        {lines.map((l, i) => (
          <li
            key={i}
            className={cn(
              i === lines.length - 1 &&
                l.endsWith("decisivo") &&
                "text-muted-foreground"
            )}
          >
            {l}
          </li>
        ))}
      </ol>
      {d.veto?.next && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          El veto sigue: le toca{" "}
          {d.veto.next.team_id === d.side1.team?.id
            ? teamName(d, 1)
            : teamName(d, 2)}
          .
        </p>
      )}
    </Card>
  )
}

function MapCard({
  m,
  names,
  image,
  selected,
  onPick,
}: {
  m: SeriesMap
  names: [string, string]
  image: string | null
  selected: boolean
  onPick?: () => void
}) {
  const score = (n: 1 | 2) => {
    const v = n === 1 ? m.r1 : m.r2
    return (
      <span
        className={cn(
          "font-mono text-base font-bold tabular-nums",
          m.winner === n ? "text-win" : m.winner && "text-muted-foreground"
        )}
      >
        {v ?? "–"}
      </span>
    )
  }
  const pick = (n: 1 | 2) =>
    m.pick === n && (
      <Badge variant="solid" shape="tag" size="xs" className="font-bold">
        PICK
      </Badge>
    )
  const status = m.live
    ? "en vivo"
    : m.manual
      ? "sin detalle"
      : m.leftOver
        ? "no se jugó"
        : m.decider
          ? "decisivo"
          : m.r1 == null
            ? "por jugar"
            : null
  const body = (
    <>
      <span
        className="relative block bg-muted bg-cover bg-center px-3 py-1.5 text-center text-[13px] font-bold"
        style={image ? { backgroundImage: `url(${image})` } : undefined}
      >
        {image && <span aria-hidden className="absolute inset-0 bg-black/55" />}
        <span className={cn("relative", image && "text-white")}>
          Mapa {m.n} · {m.map ?? "por definir"}
        </span>
      </span>
      <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-[13px]">
        <span className="flex min-w-0 items-center gap-1.5">
          {pick(1)}
          <span className="truncate">{names[0]}</span>
          <span className="ml-auto">{score(1)}</span>
        </span>
        <span className="flex flex-col items-center text-[11px] text-muted-foreground">
          {status && (
            <span className={cn(m.live && "font-semibold text-destructive")}>
              {status}
            </span>
          )}
          {onPick && (
            <span className="font-medium text-foreground underline-offset-2 group-hover:underline">
              stats
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="mr-auto">{score(2)}</span>
          <span className="truncate text-right">{names[1]}</span>
          {pick(2)}
        </span>
      </span>
    </>
  )
  const cls = cn(
    "group flex w-full flex-col overflow-hidden text-left",
    m.leftOver && "opacity-50",
    selected && "border-primary ring-1 ring-primary"
  )
  if (m.live)
    return (
      <Card variant="outline" asChild className={cls}>
        <Link
          to="/mixes/live/$uid"
          params={{ uid: m.liveUid! }}
          aria-label={`Ver el mapa ${m.n} en vivo`}
        >
          {body}
        </Link>
      </Card>
    )
  if (onPick)
    return (
      <Card variant="outline" asChild className={cls}>
        <button
          type="button"
          onClick={onPick}
          aria-pressed={selected}
          aria-label={`Ver las estadísticas de ${m.map ?? `mapa ${m.n}`}`}
        >
          {body}
        </button>
      </Card>
    )
  return (
    <Card variant="outline" className={cls}>
      {body}
    </Card>
  )
}

function MapChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-3 text-[13px] text-muted-foreground hover:text-foreground",
        active && "bg-card text-foreground shadow-xs"
      )}
    >
      {label}
    </button>
  )
}

function Info({ d }: { d: SeriesDetail }) {
  const rows: [string, React.ReactNode][] = []
  if (d.server?.name) rows.push(["Servidor", d.server.name])
  if (d.server?.address && d.status !== "finished")
    rows.push([
      "Conectar",
      <span key="a" className="font-mono">
        {d.server.address}
      </span>,
    ])
  if (d.link_code && d.status !== "finished")
    rows.push([
      "Código de !match",
      <span key="c" className="font-mono font-semibold">
        {d.link_code}
      </span>,
    ])
  if (d.starts_at && d.status === "upcoming")
    rows.push(["Empieza", fmtLong(d.starts_at)])
  if (rows.length === 0) return null
  return (
    <>
      <Heading>La partida</Heading>
      <Card variant="outline" className="px-4 py-3">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right first-letter:uppercase">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  )
}

function Demos({ maps }: { maps: SeriesMap[] }) {
  const games = maps.filter((m) => m.game)
  if (games.length === 0) return null
  return (
    <>
      <Heading>Demos</Heading>
      <Card
        variant="outline"
        className="flex flex-col items-start gap-1.5 px-4 py-3 text-[13px]"
      >
        {games.map((m) => {
          const g = m.game!
          const label = `Mapa ${m.n} · ${m.map ?? ""}`
          return g.demo_status === "uploaded" && g.demo_url ? (
            <a
              key={g.id}
              href={g.demo_url}
              download
              className="inline-flex items-center gap-2 hover:underline"
            >
              <DownloadIcon aria-hidden className="size-[13px]" />
              {label}
              {g.demo_size && (
                <span className="text-muted-foreground">
                  · {demoMb(g.demo_size)} MB
                </span>
              )}
            </a>
          ) : (
            <span key={g.id} className="text-muted-foreground">
              {label} ·{" "}
              {g.demo_status === "pending"
                ? "subiéndose"
                : g.demo_status === "expired"
                  ? "vencida (90 días)"
                  : "sin demo"}
            </span>
          )
        })}
      </Card>
    </>
  )
}

function Lineups({ d }: { d: SeriesDetail }) {
  const { sides, source } = lineups(d)
  const rows = Math.max(sides[0].length, sides[1].length)
  if (rows === 0) return null
  return (
    <>
      <Heading>
        {source === "series"
          ? "Alineaciones · rating de la serie"
          : source === "recent"
            ? "Alineaciones · rating de las últimas 4 semanas (5v5)"
            : "Alineaciones"}
      </Heading>
      <Card
        variant="outline"
        className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 py-3 text-[13px]"
      >
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="contents">
            <LineupCell p={sides[0][i]} />
            <LineupCell p={sides[1][i]} reverse />
          </div>
        ))}
      </Card>
    </>
  )
}

function LineupCell({
  p,
  reverse,
}: {
  p?: { name: string; rating: number | null }
  reverse?: boolean
}) {
  if (!p) return <span />
  return (
    <span
      className={cn(
        "flex min-w-0 items-baseline gap-2",
        reverse && "flex-row-reverse"
      )}
    >
      <span className="truncate">{p.name}</span>
      {p.rating != null && (
        <span
          className={cn(
            "font-mono text-xs font-semibold tabular-nums",
            reverse ? "mr-auto" : "ml-auto",
            p.rating >= 1 ? "text-win" : "text-muted-foreground"
          )}
        >
          {p.rating.toFixed(2)}
        </span>
      )}
    </span>
  )
}

function Clips({ maps }: { maps: SeriesMap[] }) {
  const ids = maps.flatMap((m) => (m.game ? [m.game.id] : []))
  const { byGame, pending } = useSeriesClips(ids)
  const clips = carouselClips(maps, byGame)
  const waiting = clipsPending(maps)
  const [open, setOpen] = useState<SeriesClip | null>(null)
  const strip = useRef<HTMLDivElement>(null)
  if (ids.length === 0 || (pending && clips.length === 0)) return null
  if (clips.length === 0 && !waiting) return null
  const scroll = (dir: 1 | -1) =>
    strip.current?.scrollBy({ left: dir * 460, behavior: "smooth" })
  return (
    <section aria-label="Jugadas destacadas" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Heading>Jugadas destacadas</Heading>
        {clips.length > 2 && (
          <span className="ml-auto flex gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Anteriores"
              onClick={() => scroll(-1)}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Siguientes"
              onClick={() => scroll(1)}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </span>
        )}
      </div>
      {open && <ClipPlayer clip={open} onClose={() => setOpen(null)} />}
      <div
        ref={strip}
        className="flex snap-x gap-2.5 overflow-x-auto overflow-y-hidden pb-1.5"
        tabIndex={0}
        aria-label="Clips de la serie"
      >
        {clips.length === 0 && (
          <ProcessingCard
            text="Procesando clips…"
            sub="Aparecen cuando se graben"
          />
        )}
        {clips.map((c) => {
          const who = c.player?.alias ?? c.game_nick
          const ready =
            c.video.status === "done" && !!(c.video.url || c.video.embed_url)
          if (!ready)
            return (
              <ProcessingCard
                key={c.id}
                text="Procesando clips…"
                sub={`${who} · ${c.map ?? ""}, ronda ${c.round}`}
              />
            )
          return (
            <Card
              key={c.id}
              variant="outline"
              asChild
              className={cn(
                "w-[220px] flex-none snap-start overflow-hidden text-left",
                open?.id === c.id && "border-primary ring-1 ring-primary"
              )}
            >
              <button
                type="button"
                onClick={() => setOpen(c)}
                aria-label={`Ver ${clipKind(c.type)} de ${who}`}
              >
                <span className="relative grid h-[118px] place-items-center bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_35%,#111),#111_70%)] text-white">
                  <Badge
                    variant="solid"
                    shape="tag"
                    size="sm"
                    className="absolute top-2 left-2 font-mono font-bold"
                  >
                    {clipKind(c.type)}
                  </Badge>
                  <span className="grid size-9 place-items-center rounded-full bg-white/20">
                    <PlayIcon aria-hidden className="size-4" />
                  </span>
                  {c.video.seconds != null && (
                    <span className="absolute right-2 bottom-2 rounded bg-black/55 px-1 font-mono text-[11px]">
                      0:{String(Math.round(c.video.seconds)).padStart(2, "0")}
                    </span>
                  )}
                </span>
                <span className="flex flex-col px-2.5 py-2 text-[13px]">
                  <span className="truncate font-medium">{who}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.map} · ronda {c.round}
                  </span>
                </span>
              </button>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

function ProcessingCard({ text, sub }: { text: string; sub: string }) {
  return (
    <Card
      variant="outline"
      className="w-[220px] flex-none snap-start overflow-hidden"
    >
      <span className="grid h-[118px] place-items-center bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_10px,var(--card)_10px,var(--card)_20px)] text-[13px] text-muted-foreground">
        <span className="flex flex-col items-center gap-2">
          <Spinner className="size-5" />
          {text}
        </span>
      </span>
      <span className="truncate px-2.5 py-2 text-xs text-muted-foreground">
        {sub}
      </span>
    </Card>
  )
}

function ClipPlayer({
  clip,
  onClose,
}: {
  clip: SeriesClip
  onClose: () => void
}) {
  const who = clip.player?.alias ?? clip.game_nick
  return (
    <Card variant="outline" className="gap-2 overflow-hidden p-2.5">
      <div className="aspect-video max-h-[420px] w-full overflow-hidden rounded-lg bg-black">
        {clip.video.url ? (
          <video
            key={clip.id}
            src={clip.video.url}
            controls
            autoPlay
            preload="metadata"
            className="size-full object-contain"
            aria-label={`Clip de ${who}`}
          />
        ) : clip.video.embed_url ? (
          <iframe
            key={clip.id}
            src={clip.video.embed_url}
            title={`Clip de ${who}`}
            allow="autoplay; fullscreen"
            className="size-full border-0"
          />
        ) : null}
      </div>
      <div className="flex items-center gap-2 px-1 text-[13px]">
        <Badge
          variant="solid"
          shape="tag"
          size="sm"
          className="font-mono font-bold"
        >
          {clipKind(clip.type)}
        </Badge>
        <span className="font-medium">{who}</span>
        <span className="text-muted-foreground">
          · {clip.map}, ronda {clip.round}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          aria-label="Cerrar el clip"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
    </Card>
  )
}
