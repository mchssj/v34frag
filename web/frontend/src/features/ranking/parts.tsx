import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CrownIcon,
  GitCompareIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { myProfileOptions } from "@/features/profile/queries"

// Piezas que comparten las tablas de jugadores, de equipos y el comparador.

/** Ficha y equipos del usuario logueado, para resaltar su fila y "TU EQUIPO". */
export function useMine() {
  const profile = useQuery(myProfileOptions).data
  return {
    playerId: profile?.player?.id ?? null,
    teamIds: new Set(profile?.teams.map((t) => t.id) ?? []),
  }
}

export function PlayerAvatar({
  alias,
  photo,
  className,
}: {
  alias: string
  photo: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-[30px] after:hidden", className)}>
      {photo && <AvatarImage src={photo} alt="" />}
      <AvatarFallback className="bg-secondary text-xs font-semibold text-foreground">
        {alias.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

export function MineChip() {
  return (
    <span className="inline-flex h-[18px] items-center rounded-[4px] bg-primary/15 px-1.5 text-[10px] font-bold tracking-[.03em] text-primary">
      TU EQUIPO
    </span>
  )
}

/** El primer equipo y "+n" con un tooltip que nombra los demás (ya es común estar en varios). */
export function TeamsCell({
  teams,
  empty = "Sin equipo",
}: {
  teams: { id: string; name: string }[]
  empty?: string
}) {
  if (!teams.length)
    return <span className="text-muted-foreground">{empty}</span>
  const rest = teams.slice(1)
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {teams[0].name}
      {rest.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            className="inline-flex h-[18px] items-center rounded-[4px] bg-muted px-[5px] font-mono text-[11px] font-semibold text-foreground"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label={`También en ${rest.map((t) => t.name).join(", ")}`}
          >
            +{rest.length}
          </TooltipTrigger>
          <TooltipContent>
            También en {rest.map((t) => t.name).join(", ")}
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}

/** Tendencia de los últimos mixes: 80×20, `win` si sube y `destructive` si baja. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2)
    return <span className="text-xs text-muted-foreground">—</span>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * 78 + 1,
    19 - ((v - min) / (max - min || 1)) * 17,
  ])
  const up = values[values.length - 1] >= values[0]
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg
      width="80"
      height="20"
      viewBox="0 0 80 20"
      role="img"
      aria-label={
        up ? "Sube en sus últimos mixes" : "Baja en sus últimos mixes"
      }
      className={cn("inline-block", up ? "text-win" : "text-destructive")}
    >
      <polyline
        points={pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r="2" fill="currentColor" />
    </svg>
  )
}

/** Cabecera de una columna que ordena: clic alterna desc → asc → orden por defecto. */
export function SortHead({
  label,
  active,
  order,
  onClick,
}: {
  label: string
  active: boolean
  order: "asc" | "desc"
  onClick: () => void
}) {
  const Icon = order === "asc" ? ArrowUpIcon : ArrowDownIcon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ordenar por ${label}`}
      className={cn(
        "inline-flex items-center gap-[3px] rounded-sm hover:text-foreground",
        active && "text-foreground"
      )}
    >
      {label}
      {active && <Icon aria-hidden className="size-3" />}
    </button>
  )
}

/** Cabecera de Ranking: título, subtítulo, segmentado Jugadores / Equipos y "Comparar". */
export function RankingHeader({
  mode,
  subtitle,
}: {
  mode: "players" | "teams"
  subtitle: string
}) {
  const seg =
    "inline-flex h-[30px] items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-3.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
  const on = "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/.1)]"
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-[-0.4px]">Ranking</h1>
        <p className="max-w-[62ch] text-sm text-pretty text-muted-foreground">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <nav
          aria-label="Modo del ranking"
          className="inline-flex h-9 gap-0.5 rounded-lg bg-muted p-[3px]"
        >
          <Link
            to="/ranking"
            className={cn(seg, mode === "players" && on)}
            aria-current={mode === "players" ? "page" : undefined}
          >
            <UserIcon aria-hidden className="size-3.5" />
            Jugadores
          </Link>
          <Link
            to="/ranking/teams"
            className={cn(seg, mode === "teams" && on)}
            aria-current={mode === "teams" ? "page" : undefined}
          >
            <ShieldIcon aria-hidden className="size-3.5" />
            Equipos
          </Link>
        </nav>
        {mode === "players" && (
          <Link
            to="/players/compare"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-9 gap-1.5 px-3 text-[13px] font-medium"
            )}
          >
            <GitCompareIcon aria-hidden className="size-3.5" />
            Comparar
          </Link>
        )}
      </div>
    </div>
  )
}

export type PodiumItem = {
  key: string
  name: string
  sub: string
  value: number
  badge: ReactNode
  link: ReactNode
}

/** Top 3 en tarjetas: el 1.º con borde `primary` al 50 %, número en `primary` y corona. */
export function Podium({
  items,
  loading,
}: {
  items: PodiumItem[]
  loading: boolean
}) {
  if (loading)
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[84px] rounded-xl" />
        ))}
      </div>
    )
  if (!items.length) return null
  return (
    <ol aria-label="Podio" className="grid gap-4 md:grid-cols-3">
      {items.map((it, i) => (
        <li
          key={it.key}
          className={cn(
            "relative flex min-w-0 items-center gap-3.5 rounded-xl border bg-card p-[18px] shadow-[0_1px_2px_rgb(0_0_0/.04)] transition-colors focus-within:bg-muted hover:bg-muted",
            i === 0 &&
              "border-[color-mix(in_oklch,var(--primary)_50%,var(--border))]"
          )}
        >
          <span
            className={cn(
              "font-mono text-[32px] font-bold tracking-[-1px]",
              i === 0 ? "text-primary" : "text-muted-foreground"
            )}
          >
            {i + 1}
          </span>
          <span className="relative shrink-0">
            {it.badge}
            {i === 0 && (
              <CrownIcon
                aria-hidden
                className="absolute -top-3 left-1/2 size-[18px] -translate-x-1/2 fill-primary text-primary"
              />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">
              {it.link}
            </span>
            <span className="text-xs text-muted-foreground">{it.sub}</span>
          </span>
          <span className="font-mono text-xl font-semibold tabular-nums">
            {it.value}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Link que cubre toda la tarjeta o la fila (el resto del contenido queda por encima del clic). */
export const coverLink =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
