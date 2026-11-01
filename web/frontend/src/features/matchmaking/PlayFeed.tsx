import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { ArrowRightIcon, PlayIcon, TrophyIcon } from "lucide-react"
import type { ReactNode } from "react"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { MapBackdrop } from "@/features/mixes/components/MapBackdrop"
import { LiveChip } from "@/features/mixes/components/parts"
import { BlockPanel } from "./BlockPanel"
import { FriendsPanel } from "./FriendsPanel"
import { fmtDateTime, mapLabel } from "./labels"
import { feedOptions } from "./queries"
import { useMmSource } from "./source"
import type { MmFeed, MmSanction, MmState } from "./types"

// Debajo de Mi grupo: lo que está pasando en la liga. Todo sale de rutas que ya existen (mixes en
// vivo, mis partidas y el ranking).

export function PlayFeed({ state }: { state: MmState }) {
  const source = useMmSource()
  const { data, isError } = useQuery(feedOptions(source))
  if (isError) return null
  if (!data) return <Skeleton className="h-64 w-full rounded-xl" />
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <FriendsPanel friends={state.friends} />
        <BlockPanel blocks={state.blocks} />
        <Sanctions sanctions={state.sanctions} />
      </div>
      <Highlight item={data.highlight} />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <LiveNow items={data.live} />
        <RecentMatches items={data.recent} />
        <TopPlayers items={data.top} />
      </div>
    </div>
  )
}

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function MoreLink({
  to,
  children,
}: {
  to: "/mixes" | "/ranking"
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      {children}
      <ArrowRightIcon aria-hidden className="size-3" />
    </Link>
  )
}

const SANCTION_KIND: Record<MmSanction["kind"], string> = {
  penalty: "Sanción de la cola",
  mm_ban: "Exclusión del matchmaking",
  server_ban: "Baneo del servidor",
}

/** Tus sanciones, el motivo y cuándo vencen. Evita tener que preguntarle a un admin. */
function Sanctions({ sanctions }: { sanctions: MmState["sanctions"] }) {
  return (
    <Panel title="Mis sanciones">
      <div className="flex flex-col gap-2 p-4 text-[13px]">
        {sanctions.level > 0 && sanctions.level_resets_at && (
          <p className="text-xs text-muted-foreground">
            Escalón {sanctions.level}: baja el{" "}
            {fmtDateTime(sanctions.level_resets_at)} si no volvés a faltar.
          </p>
        )}
        {sanctions.items.length === 0 ? (
          <p className="text-muted-foreground">No tenés sanciones.</p>
        ) : (
          <ul className="flex max-h-44 flex-col gap-2 overflow-y-auto">
            {sanctions.items.map((s) => (
              <li key={s.id} className="flex flex-col">
                <span className="font-medium">{s.reason}</span>
                <span className="text-xs text-muted-foreground">
                  {SANCTION_KIND[s.kind]} · {fmtDateTime(s.created_at)}
                  {s.until
                    ? ` · hasta ${fmtDateTime(s.until)}`
                    : " · sin vencimiento"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

/** La mejor jugada de la semana. */
function Highlight({ item }: { item: MmFeed["highlight"] }) {
  if (!item) return null
  return (
    <section
      aria-label="Jugada de la semana"
      className="overflow-hidden rounded-xl border bg-card"
    >
      <Link
        to="/match/$id"
        params={{ id: item.match_id }}
        className="block h-full transition-opacity hover:opacity-85"
      >
        <MapBackdrop image={item.image_url} className="h-full py-0">
          <div className="flex h-full min-h-24 flex-col justify-end gap-0.5 p-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <PlayIcon aria-hidden className="size-3" />
              Jugada de la semana
            </span>
            <span className="text-lg font-semibold">{item.title}</span>
            <span className="text-[13px] text-muted-foreground">
              {item.nick}
            </span>
          </div>
        </MapBackdrop>
      </Link>
    </section>
  )
}

function LiveNow({ items }: { items: MmFeed["live"] }) {
  return (
    <Panel
      title="Partidas en vivo"
      action={<MoreLink to="/mixes">Ver todas</MoreLink>}
    >
      {items.length === 0 && (
        <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
          Ahora no hay partidas. Sé el primero en armar una.
        </p>
      )}
      <ul className="flex flex-col divide-y">
        {items.map((m) => (
          <li key={m.uid}>
            <Link
              to="/mixes/live/$uid"
              params={{ uid: m.uid }}
              className="block transition-opacity hover:opacity-85"
            >
              <MapBackdrop image={m.image_url} className="py-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col text-[13px] font-medium">
                    <span className="truncate">{m.side1_name}</span>
                    <span className="truncate">{m.side2_name}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <LiveChip />
                    <span className="font-mono text-lg leading-none font-bold tabular-nums">
                      {m.score1} : {m.score2}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.map ? mapLabel(m.map) : "Mapa"} · ronda {m.round}
                    </span>
                  </span>
                </div>
              </MapBackdrop>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function RecentMatches({ items }: { items: MmFeed["recent"] }) {
  return (
    <Panel title="Tus últimas partidas">
      {items.length === 0 && (
        <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
          Todavía no jugaste. Tu historial va a aparecer acá.
        </p>
      )}
      <ul className="flex flex-col divide-y">
        {items.map((m) => (
          <li key={m.match_id}>
            <Link
              to="/match/$id"
              params={{ id: m.match_id }}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-[13px] transition-colors hover:bg-muted/50",
                m.won
                  ? "shadow-[inset_3px_0_0_var(--win)]"
                  : "shadow-[inset_3px_0_0_var(--destructive)]"
              )}
            >
              <span className="h-8 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">
                  {m.map ? mapLabel(m.map) : "Mapa"}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {m.kills}/{m.deaths} · {m.rating?.toFixed(2) ?? "—"}
                </span>
              </span>
              <span
                className={cn(
                  "ml-auto font-mono font-semibold tabular-nums",
                  m.won ? "text-win" : "text-destructive"
                )}
              >
                {m.score}
              </span>
              <span
                className={cn(
                  "w-9 text-right font-mono text-xs tabular-nums",
                  (m.elo_delta ?? 0) >= 0 ? "text-win" : "text-destructive"
                )}
              >
                {m.elo_delta === null
                  ? "—"
                  : `${m.elo_delta > 0 ? "+" : ""}${m.elo_delta}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function TopPlayers({ items }: { items: MmFeed["top"] }) {
  return (
    <Panel
      title="Los mejores de la temporada"
      action={<MoreLink to="/ranking">Ranking</MoreLink>}
    >
      <ol className="flex flex-col divide-y">
        {items.map((p) => (
          <li key={p.nick}>
            <Link
              to="/player/$nick"
              params={{ nick: p.nick }}
              className="flex items-center gap-3 px-4 py-2 text-[13px] transition-colors hover:bg-muted/50"
            >
              <span
                className={cn(
                  "grid w-5 place-items-center font-mono font-semibold text-muted-foreground tabular-nums",
                  p.position === 1 && "text-primary"
                )}
              >
                {p.position === 1 ? (
                  <TrophyIcon aria-label="Primero" className="size-4" />
                ) : (
                  p.position
                )}
              </span>
              <Avatar className="size-8">
                {p.photo_url && <AvatarImage src={p.photo_url} alt="" />}
                <AvatarFallback className="text-[10px] font-semibold">
                  {p.nick.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{p.nick}</span>
              <span className="ml-auto font-mono font-semibold tabular-nums">
                {p.elo.toLocaleString("es-AR")}
              </span>
              <LevelBadge level={p.level} size={22} />
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
