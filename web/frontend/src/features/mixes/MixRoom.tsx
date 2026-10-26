import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  BanIcon,
  CircleAlertIcon,
  ClockIcon,
  DownloadIcon,
  LoaderIcon,
  ServerIcon,
} from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MapBackdrop } from "./MapBackdrop"
import {
  cancelReasonLabel,
  demoMb,
  fmtAgo,
  fmtDay,
  fmtTime,
  signed,
} from "./labels"
import { WatchTvButton } from "./parts"
import type { Room, RoomPlayer, RoomSide, SideResult } from "./room"
import {
  bestValues,
  columnsFor,
  nextSort,
  partialRounds,
  sortPlayers,
  type StatColumn,
  type StatsSort,
  type StatsTab,
} from "./stats"
import { StatsTabs } from "./StatsTabs"

// Sala del mix (handoff_mixes, sección 4): cabecera, marcador, barra con la demo o la TV y una
// tabla por bando. La usan la sala en vivo y la de un mix terminado o cancelado.

export function MixRoom({
  room,
  mapImage,
  adminAction,
  tab = "general",
  onTab,
}: {
  room: Room
  mapImage: string | null
  /** "Borrar este mix" (solo admin, solo terminados o cancelados). */
  adminAction?: ReactNode
  /** Pestaña de estadísticas (en la URL, `?stats=`). */
  tab?: StatsTab
  onTab?: (tab: StatsTab) => void
}) {
  const live = room.status === "live"
  // El orden por columna es del componente; con las dos tablas a la vez, como las pestañas.
  const [sort, setSort] = useState<StatsSort>(null)
  const cols = columnsFor(tab, room.status)
  const best = bestValues(cols, [...room.side1.players, ...room.side2.players])
  const pickTab = (t: StatsTab) => {
    setSort(null)
    onTab?.(t)
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/mixes"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "h-[30px] gap-1.5 pr-2.5 pl-1.5 text-[13px]"
          )}
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Volver
        </Link>
        <span className="text-[13px] text-muted-foreground">
          {live ? "Mix en vivo" : "Mix"} · reportado por el servidor
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/.04)]">
        <MapBackdrop image={mapImage}>
          <Scoreboard room={room} />
        </MapBackdrop>
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/50 px-4 py-2.5 text-[13px]">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <ServerIcon aria-hidden className="size-[13px]" />
            {[room.server, room.at && `${fmtDay(room.at)} ${fmtTime(room.at)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {live ? (
              room.tv && (
                <WatchTvButton
                  tv={room.tv}
                  label="Ver en CM League TV"
                  className="h-[30px] px-3 text-[13px]"
                />
              )
            ) : (
              <DemoButton demo={room.demo} />
            )}
            {adminAction}
          </span>
        </div>
      </div>

      {room.status === "cancelled" && (
        <Notice icon={<BanIcon aria-hidden className="size-4" />}>
          Mix cancelado por{" "}
          <b className="font-semibold">
            {cancelReasonLabel(room.cancelReason)}
          </b>
          .{" "}
          {room.reviewPending
            ? "Un admin tiene que decidir si cuenta para el ELO."
            : "No afecta al ELO."}
        </Notice>
      )}
      {live && room.stale && (
        <Notice icon={<ClockIcon aria-hidden className="size-4" />}>
          Sin novedades del servidor desde hace más de 10 minutos.
        </Notice>
      )}

      <StatsTabs value={tab} onChange={pickTab} />
      {tab === "clutch" && room.clutchData !== true ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
          {live
            ? "Los clutches se cuentan al terminar el mix."
            : "Sin datos de Clutches disponibles."}
        </p>
      ) : (
        (["side1", "side2"] as const).map((s, i) => (
          <SideTable
            key={s}
            side={room[s]}
            accent={i === 0 ? "a" : "b"}
            status={room.status}
            cols={cols}
            best={best}
            totalRounds={room.side1.score + room.side2.score}
            sort={sort}
            onSort={(key) => setSort((cur) => nextSort(cur, key))}
            footer={
              tab === "clutch" && i === 1 ? (
                <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                  Solo clutches ganados.
                </p>
              ) : undefined
            }
          />
        ))
      )}
    </section>
  )
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border bg-muted px-4 py-3 text-[13px]">
      {icon}
      <span>{children}</span>
    </div>
  )
}

const STATUS_CHIP = {
  live: { label: "EN VIVO", className: "bg-destructive text-white" },
  finished: {
    label: "FINAL",
    className: "bg-secondary text-secondary-foreground",
  },
  cancelled: {
    label: "CANCELADO",
    className: "bg-muted text-muted-foreground",
  },
} as const

function Scoreboard({ room }: { room: Room }) {
  const chip = STATUS_CHIP[room.status]
  const sub =
    room.status === "live"
      ? [
          room.map,
          room.round && `ronda ${room.round}`,
          room.at && `empezó ${fmtAgo(room.at)}`,
        ]
      : [room.map, "rondas"]
  return (
    <div className="grid grid-cols-1 items-center gap-3.5 px-4 pt-5 pb-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-5 sm:px-6 sm:pt-6">
      <div className="order-2 flex min-w-0 flex-row-reverse items-center justify-end gap-3.5 sm:order-none sm:flex-row">
        <SideName side={room.side1} align="end" />
        <SideTag tag="A" side={room.side1} />
      </div>
      <div className="order-1 flex min-w-[140px] flex-col items-center gap-1.5 sm:order-none">
        <span
          className={cn(
            "inline-flex h-[22px] items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-2 text-[11px] font-semibold tracking-[.3px]",
            chip.className
          )}
        >
          {room.status === "live" && (
            <span
              aria-hidden
              className="size-1.5 animate-live rounded-full bg-current"
            />
          )}
          {chip.label}
        </span>
        <span className="font-mono text-[40px] leading-none font-bold tracking-[-2px] whitespace-nowrap tabular-nums in-data-photo:[text-shadow:0_2px_14px_rgb(0_0_0/.55)]">
          {room.side1.score} : {room.side2.score}
        </span>
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {sub.filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="order-3 flex min-w-0 items-center gap-3.5 sm:order-none">
        <SideTag tag="B" side={room.side2} />
        <SideName side={room.side2} align="start" />
      </div>
    </div>
  )
}

function SideName({ side, align }: { side: RoomSide; align: "start" | "end" }) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-col",
        align === "end" ? "items-start sm:items-end" : "items-start"
      )}
    >
      <span className="max-w-full truncate text-xl font-semibold">
        {side.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {side.players.length === 1
          ? "1 jugador"
          : `${side.players.length} jugadores`}
      </span>
    </span>
  )
}

function SideTag({ tag, side }: { tag: string; side: RoomSide }) {
  return (
    <span
      className={cn(
        "grid size-14 flex-none place-items-center rounded-tile bg-muted font-mono text-sm font-bold",
        // Con foto del mapa: cuadro translúcido sobre la imagen.
        "in-data-photo:border in-data-photo:border-white/20 in-data-photo:bg-white/14 in-data-photo:backdrop-blur-md",
        side.result === "win" &&
          "shadow-[inset_0_0_0_2px_var(--primary)] in-data-photo:border-transparent"
      )}
    >
      {tag}
    </span>
  )
}

function DemoButton({ demo }: { demo: Room["demo"] }) {
  const quiet = "h-[30px] px-3 text-[13px] text-muted-foreground"
  if (demo.status === "uploaded" && demo.url) {
    return (
      <a
        href={demo.url}
        download
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-[30px] gap-1.5 px-3 text-[13px]"
        )}
      >
        <DownloadIcon aria-hidden className="size-[13px]" />
        {demo.size
          ? `Descargar demo (${demoMb(demo.size)} MB)`
          : "Descargar demo"}
      </a>
    )
  }
  const [icon, label] =
    demo.status === "pending"
      ? [
          <LoaderIcon
            key="i"
            aria-hidden
            className="size-[13px] motion-safe:animate-spin"
          />,
          "La demo se está subiendo",
        ]
      : demo.status === "expired"
        ? [
            <ClockIcon key="i" aria-hidden className="size-[13px]" />,
            "Demo vencida (90 días)",
          ]
        : demo.status === "missing"
          ? [
              <CircleAlertIcon key="i" aria-hidden className="size-[13px]" />,
              "Demo no encontrada",
            ]
          : [
              <BanIcon key="i" aria-hidden className="size-[13px]" />,
              "Sin demo",
            ]
  return (
    <Button variant="outline" size="sm" disabled className={quiet}>
      {icon}
      {label}
    </Button>
  )
}

const RESULT: Record<SideResult, { label: string; className: string }> = {
  win: { label: "Victoria", className: "bg-win/18 text-win" },
  loss: { label: "Derrota", className: "bg-destructive/15 text-destructive" },
  playing: { label: "En juego", className: "bg-muted text-muted-foreground" },
  cancelled: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
  draw: { label: "Empate", className: "bg-muted text-muted-foreground" },
}

function SideTable({
  side,
  accent,
  status,
  cols,
  best,
  totalRounds,
  sort,
  onSort,
  footer,
}: {
  side: RoomSide
  accent: "a" | "b"
  status: Room["status"]
  cols: StatColumn[]
  best: Record<string, number | null>
  /** Rondas del mix (las dos puntuaciones): para marcar a quien jugó menos. */
  totalRounds: number
  sort: StatsSort
  onSort: (key: string) => void
  footer?: ReactNode
}) {
  const res = RESULT[side.result]
  const players = sortPlayers(side.players, cols, sort)
  return (
    <section
      aria-label={side.name}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div
        className={cn(
          "flex items-center gap-2.5 border-b px-4 py-3",
          accent === "a"
            ? "shadow-[inset_3px_0_0_var(--primary)]"
            : "shadow-[inset_3px_0_0_var(--chart-2)]"
        )}
      >
        <h2 className="text-sm font-semibold">{side.name}</h2>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-[calc(var(--radius)-4px)] px-1.5 text-[11px] font-semibold",
            res.className
          )}
        >
          {res.label}
        </span>
        <span className="ml-auto font-mono text-lg font-semibold tabular-nums">
          {side.score}
        </span>
      </div>
      <Table
        className={cn(
          "table-fixed text-[13px]",
          cols.length > 8 ? "min-w-[1000px]" : "min-w-[560px]"
        )}
      >
        <TableHeader>
          <TableRow className="text-xs hover:bg-transparent">
            <TableHead className="sticky left-0 z-[1] w-[210px] bg-card pl-4 font-medium text-muted-foreground">
              Jugador
            </TableHead>
            {cols.map((c, i) => (
              <TableHead
                key={c.key}
                className={cn(
                  "font-medium text-muted-foreground",
                  i === cols.length - 1 ? "pr-4 text-right" : "text-center"
                )}
              >
                <StatHead
                  col={c}
                  sort={sort?.key === c.key ? sort.dir : null}
                  onClick={() => onSort(c.key)}
                />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p) => (
            <PlayerRow
              key={p.key}
              p={p}
              cols={cols}
              best={best}
              rounds={partialRounds(p, totalRounds)}
              showMvp={status !== "cancelled"}
            />
          ))}
        </TableBody>
      </Table>
      {footer}
    </section>
  )
}

/** Cabecera de una columna: ordena con un clic y, si tiene ayuda, la muestra en un tooltip. */
function StatHead({
  col,
  sort,
  onClick,
}: {
  col: StatColumn
  sort: "asc" | "desc" | null
  onClick: () => void
}) {
  const Icon = sort === "asc" ? ArrowUpIcon : ArrowDownIcon
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ordenar por ${col.label}`}
      className={cn(
        "inline-flex items-center gap-[3px] rounded-sm font-mono hover:text-foreground",
        col.help && "underline decoration-dotted underline-offset-[3px]",
        sort && "text-foreground"
      )}
    >
      {col.label}
      {sort && <Icon aria-hidden className="size-3" />}
    </button>
  )
  if (!col.help) return button
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{col.help}</TooltipContent>
    </Tooltip>
  )
}

const num = "text-center font-mono tabular-nums"

function formatStat(v: number | null, c: StatColumn): ReactNode {
  if (v === null) return <span className="text-muted-foreground">—</span>
  switch (c.format) {
    case "dec2":
      return v.toFixed(2)
    case "pct":
      return `${v}%`
    case "signed":
      return (
        <span className={v >= 0 ? "text-win" : "text-destructive"}>
          {signed(v)}
        </span>
      )
    case "zero":
      return v === 0 ? <span className="text-muted-foreground">0</span> : v
    default:
      return v
  }
}

function PlayerRow({
  p,
  cols,
  best,
  rounds,
  showMvp,
}: {
  p: RoomPlayer
  cols: StatColumn[]
  best: Record<string, number | null>
  /** "12/22 rondas" si jugó menos que el mix; null en un mix completo. */
  rounds: string | null
  showMvp: boolean
}) {
  return (
    <TableRow className={cn(p.me && "bg-primary/6 hover:bg-primary/8")}>
      <TableCell
        className={cn(
          "sticky left-0 z-[1] bg-card py-[9px] pl-4",
          p.me && "bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))]"
        )}
      >
        <span className="flex items-center gap-2 whitespace-nowrap">
          {p.alias ? (
            <Link
              to="/player/$nick"
              params={{ nick: p.alias }}
              className="font-medium hover:underline"
            >
              {p.nick}
            </Link>
          ) : (
            <span className="font-medium">{p.nick}</span>
          )}
          {showMvp && p.mvp && (
            <span className="inline-flex h-[18px] items-center rounded-[4px] bg-primary px-[5px] text-[10px] font-bold text-primary-foreground">
              MVP
            </span>
          )}
          {p.guest && (
            <span
              title="Jugó sin cuenta vinculada. Se muestra con su nombre en el juego; su ELO se calcula por SteamID."
              className="inline-flex h-[18px] items-center rounded-[4px] border border-dashed px-1.5 text-[10px] font-semibold text-muted-foreground"
            >
              INVITADO
            </span>
          )}
        </span>
        {rounds && (
          <span
            title="Jugó menos rondas que el mix: entró tarde, reemplazó a alguien o se fue antes."
            className="block text-[11px] leading-tight text-muted-foreground"
          >
            {rounds}
          </span>
        )}
      </TableCell>
      {cols.map((c, i) => {
        const v = c.value(p)
        const top = best[c.key] !== null && v === best[c.key]
        return (
          <TableCell
            key={c.key}
            data-best={top || undefined}
            className={cn(
              num,
              i === cols.length - 1 && "pr-4 text-right",
              (c.strong || top) && "font-semibold",
              top && "text-foreground"
            )}
          >
            {formatStat(v, c)}
          </TableCell>
        )
      })}
    </TableRow>
  )
}
