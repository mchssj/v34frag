import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { formatDistanceStrict, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CrownIcon, TrophyIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { playerDetailOptions } from "@/features/profile/queries"
import { formatNumber } from "@/features/public/queries"
import { timeAgo } from "@/features/shell/notifications/model"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { dateRange } from "@/features/events/model"
import {
  RESULT_LABEL,
  resultFor,
  resultText,
  ROLE_SLOTS,
  rolesMap,
  type MatchResult,
  type RoleSlot,
} from "./model"
import {
  teamEventsOptions,
  teamMatchesOptions,
  teamPendingOptions,
  teamStarOptions,
  useAnswerJoin,
  type RosterEntry,
  type TeamInvite,
} from "./queries"
import { Eyebrow, Initial, Panel } from "./ui"

// --- KPIs ----------------------------------------------------------------

export function TeamKpis({
  rank,
  points,
  winRate,
  titles,
  eventsPlayed,
}: {
  rank: number | null
  points: number
  winRate: number | null
  titles: number
  eventsPlayed: number
}) {
  const items: { label: string; value: string; accent?: boolean }[] = [
    { label: "Ranking", value: rank ? `#${rank}` : "—", accent: true },
    { label: "Puntos", value: formatNumber(points) },
    { label: "% de victorias", value: winRate === null ? "—" : `${winRate}%` },
    { label: "Títulos", value: String(titles) },
    { label: "Torneos jugados", value: String(eventsPlayed) },
  ]
  return (
    <dl className="grid grid-cols-2 border-t sm:grid-cols-3 lg:grid-cols-5">
      {items.map((k) => (
        <div
          key={k.label}
          className="flex flex-col gap-1 border-b px-5 py-4 last:border-b-0 sm:border-r lg:border-b-0 lg:last:border-r-0"
        >
          <dt className="text-xs text-muted-foreground">{k.label}</dt>
          <dd
            className={cn(
              "font-mono text-2xl font-bold tracking-[-1px]",
              k.accent && "text-primary"
            )}
          >
            {k.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// --- Roles de equipo -----------------------------------------------------

const SLOT_POSITION: Record<RoleSlot, string> = {
  Entry: "left-1/2 top-[64px] -translate-x-1/2",
  Support: "left-[18%] top-[180px] -translate-x-1/2",
  Lurker: "left-[82%] top-[180px] -translate-x-1/2",
  IGL: "left-1/2 top-[250px] -translate-x-1/2",
  AWPer: "left-1/2 top-[410px] -translate-x-1/2",
}

/**
 * Mapa de roles: cada jugador va en el lugar del puesto que eligió en su perfil (`game_role`).
 * Pueden repetirse; Rifler, Otro y los que no eligieron puesto van debajo del mapa.
 */
export function TeamRoles({ members }: { members: RosterEntry[] }) {
  const { slots, others } = rolesMap(members)
  return (
    <Panel
      title="Roles de equipo"
      aside="Cada jugador elige su puesto en su perfil"
    >
      <div
        className="relative min-h-[540px] overflow-hidden bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:36px_36px]"
        role="list"
        aria-label="Roles de equipo"
      >
        <Eyebrow className="absolute top-3 left-4 text-[10px] text-muted-foreground">
          ↑ Línea de avance
        </Eyebrow>
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 size-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
        />
        {ROLE_SLOTS.map((slot) => (
          <RoleSpot key={slot} slot={slot} players={slots[slot]} />
        ))}
        <Eyebrow className="absolute bottom-3 left-4 text-[10px] text-muted-foreground">
          Retaguardia
        </Eyebrow>
      </div>
      {others.length > 0 && (
        <div className="flex flex-col gap-2 border-t px-[18px] py-3">
          <Eyebrow className="text-[10px] text-muted-foreground">
            Otros puestos
          </Eyebrow>
          <ul className="flex flex-wrap gap-2">
            {others.map((m) => (
              <li
                key={m.player_id}
                className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1"
              >
                <Initial
                  name={m.alias}
                  photo={m.photo_url}
                  className="size-6"
                  fallbackClassName="text-[10px]"
                />
                <span className="text-[13px] font-medium">{m.alias}</span>
                <span className="text-xs text-muted-foreground">
                  {m.game_role ?? "Sin puesto"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/** Un lugar del mapa: los jugadores con ese puesto (hasta 3 caras y "+n"), o "Sin asignar". */
function RoleSpot({
  slot,
  players,
}: {
  slot: RoleSlot
  players: RosterEntry[]
}) {
  const shown = players.slice(0, 3)
  const extra = players.length - shown.length
  return (
    <div
      role="listitem"
      className={cn(
        "absolute flex flex-col items-center gap-1.5",
        SLOT_POSITION[slot]
      )}
    >
      {players.length === 0 ? (
        <span className="grid size-14 place-items-center rounded-full border-2 border-dashed bg-card text-muted-foreground">
          <UserIcon className="size-4" aria-hidden />
        </span>
      ) : (
        <span className="flex -space-x-3">
          {shown.map((m) => (
            <Link
              key={m.player_id}
              to="/player/$nick"
              params={{ nick: m.alias }}
              aria-label={`Perfil de ${m.alias}`}
              className="rounded-full ring-2 ring-card outline-none hover:ring-primary focus-visible:ring-ring"
            >
              <Initial
                name={m.alias}
                photo={m.photo_url}
                className="size-14"
                fallbackClassName="text-lg"
              />
            </Link>
          ))}
          {extra > 0 && (
            <span className="grid size-14 place-items-center rounded-full bg-muted font-mono text-sm font-semibold ring-2 ring-card">
              +{extra}
            </span>
          )}
        </span>
      )}
      <span className="max-w-[160px] truncate text-sm font-semibold whitespace-nowrap">
        {players.length === 0
          ? "Sin asignar"
          : players.map((m) => m.alias).join(", ")}
      </span>
      <span className="rounded-full bg-muted px-2 font-mono text-[10px] font-semibold tracking-[1px] uppercase">
        {slot}
      </span>
    </div>
  )
}

// --- Jugador estrella ----------------------------------------------------

export function StarPlayer({ teamId }: { teamId: string }) {
  const star = useQuery(teamStarOptions(teamId)).data
  const detail = useQuery({
    ...playerDetailOptions(star?.id ?? ""),
    enabled: !!star,
  }).data
  if (!star) return null
  const stats = detail?.stats
  const fmt = (v: number | null | undefined, digits = 2) =>
    v === null || v === undefined ? "—" : v.toFixed(digits)
  const rows = [
    { k: "Rating", v: fmt(star.rating) },
    { k: "K/D", v: fmt(star.kd) },
    { k: "ADR", v: fmt(stats?.adr, 0) },
    { k: "HS", v: stats?.hs == null ? "—" : `${Math.round(stats.hs)}%` },
  ]
  const meta = [
    detail?.details?.game_role,
    star.level ? `Nivel ${star.level}` : null,
    star.elo ? `${formatNumber(star.elo)} ELO` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <section className="relative overflow-hidden rounded-hero border border-primary/35 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card)_60%)] p-5">
      <Eyebrow className="flex items-center gap-1.5 text-primary">
        <CrownIcon className="size-3.5" aria-hidden />
        Jugador estrella
      </Eyebrow>
      <Link
        to="/player/$nick"
        params={{ nick: star.alias }}
        className="mt-3 flex items-center gap-3.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Initial
          name={star.alias}
          photo={star.photo_url}
          className="size-16"
          fallbackClassName="bg-primary text-2xl font-bold text-primary-foreground"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-2xl font-bold tracking-[-0.5px]">
            {star.alias}
          </span>
          {meta && (
            <span className="text-sm text-muted-foreground">{meta}</span>
          )}
        </span>
      </Link>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((r) => (
          <div
            key={r.k}
            className="flex flex-col-reverse gap-0.5 rounded-lg bg-muted/70 px-2.5 py-2"
          >
            <dt className="text-[11px] text-muted-foreground">{r.k}</dt>
            <dd className="font-mono text-[15px] font-semibold">{r.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// --- Forma reciente ------------------------------------------------------

export function RecentForm({ teamId }: { teamId: string }) {
  const matches = useQuery(teamMatchesOptions(teamId)).data
  const results: MatchResult[] = (matches ?? []).map((m) =>
    resultFor(m, teamId)
  )
  const pills = results.filter((r) => r.won !== null)

  return (
    <Panel
      title="Forma reciente"
      aside={
        pills.length > 0 && (
          <span className="flex gap-1" aria-label="Últimos resultados">
            {pills.map((r) => (
              <span
                key={r.id}
                className={cn(
                  "grid size-5 place-items-center rounded-[4px] font-mono text-[10px] font-bold",
                  r.won
                    ? "bg-win/15 text-win"
                    : "bg-destructive/15 text-destructive"
                )}
              >
                {r.won ? "V" : "D"}
              </span>
            ))}
          </span>
        )
      }
      className="flex-1"
    >
      {results.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-muted-foreground">
          Todavía no jugó partidas.
        </p>
      ) : (
        <ul>
          {results.map((r) => (
            <li key={r.id} className="border-b last:border-b-0">
              <Link
                to="/match/$id"
                params={{ id: r.id }}
                className="flex items-center gap-3 px-[18px] py-2.5 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-7 w-[3px] shrink-0 rounded-full",
                    r.live
                      ? "bg-destructive"
                      : r.won === null
                        ? "bg-muted-foreground"
                        : r.won
                          ? "bg-win"
                          : "bg-destructive"
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    vs {r.opponent}
                  </span>
                  {r.context && (
                    <span className="truncate text-xs text-muted-foreground">
                      {r.context}
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm font-bold">{r.score}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// --- Pedidos para entrar (líder) -----------------------------------------

const expiresIn = (iso: string) =>
  `vence en ${formatDistanceStrict(new Date(), parseISO(iso), { locale: es })}`

export function JoinRequests({ teamId }: { teamId: string }) {
  const pending = useQuery(teamPendingOptions(teamId)).data
  const requests = (pending ?? []).filter((p) => p.kind === "request")
  return (
    <Panel
      title="Pedidos para entrar"
      aside={
        requests.length > 0 && (
          <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[11px] font-bold text-primary-foreground">
            {requests.length}
          </span>
        )
      }
    >
      {requests.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-muted-foreground">
          No hay pedidos pendientes.
        </p>
      ) : (
        <ul>
          {requests.map((r) => (
            <JoinRequestRow key={r.id} teamId={teamId} request={r} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function JoinRequestRow({
  teamId,
  request,
}: {
  teamId: string
  request: TeamInvite
}) {
  const answer = useAnswerJoin()
  const nick = request.player.alias

  async function reply(accept: boolean) {
    try {
      await answer.mutateAsync({ requestId: request.id, accept, teamId })
      toast.success(accept ? `${nick} entró al equipo` : "Pedido rechazado")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b px-[18px] py-3 last:border-b-0">
      <Link
        to="/player/$nick"
        params={{ nick }}
        aria-label={`Perfil de ${nick}`}
        className="rounded-full outline-none hover:ring-2 hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Initial
          name={nick}
          photo={request.player.photo_url}
          className="size-9"
          fallbackClassName="text-sm"
        />
      </Link>
      {/* Ancho mínimo: en pantallas chicas los botones bajan en lugar de aplastar el texto. */}
      <span className="flex min-w-[150px] flex-1 flex-col">
        <span className="flex items-center gap-2">
          <Link
            to="/player/$nick"
            params={{ nick }}
            className="w-fit truncate text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {nick}
          </Link>
          {request.player.level && <LevelBadge level={request.player.level} />}
        </span>
        <span className="text-xs text-muted-foreground">
          {timeAgo(request.created_at)} · {expiresIn(request.expires_at)}
        </span>
        {request.message && (
          <span className="mt-1 line-clamp-2 text-[13px] text-pretty">
            “{request.message}”
          </span>
        )}
      </span>
      <span className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={answer.isPending}
          onClick={() => void reply(false)}
        >
          Rechazar
        </Button>
        <Button
          size="sm"
          disabled={answer.isPending}
          onClick={() => void reply(true)}
        >
          Aceptar
        </Button>
      </span>
    </li>
  )
}

// --- Vitrina ------------------------------------------------------------

type Title = {
  id: string
  name: string
  ends_on: string | null
  prize: string | null
}

export function Showcase({
  titles,
  eventsPlayed,
}: {
  titles: Title[]
  eventsPlayed: number
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2.5 text-xl font-bold tracking-[-0.4px]">
        Vitrina
        <span className="text-sm font-normal text-muted-foreground">
          {titles.length === 1 ? "1 título" : `${titles.length} títulos`} ·{" "}
          {eventsPlayed === 1
            ? "1 torneo jugado"
            : `${eventsPlayed} torneos jugados`}
        </span>
      </h2>
      {titles.length === 0 ? (
        <p className="rounded-hero border border-dashed px-5 py-6 text-sm text-muted-foreground">
          Todavía no ganó un torneo.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3">
          {titles.map((t) => (
            <li key={t.id}>
              <Link
                to="/events/$id"
                params={{ id: t.id }}
                className="flex flex-col gap-3 rounded-hero border border-primary/35 bg-[linear-gradient(160deg,color-mix(in_oklch,var(--primary)_10%,var(--card)),var(--card)_65%)] p-5 outline-none hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="grid size-11 place-items-center rounded-tile bg-primary text-primary-foreground">
                  <TrophyIcon className="size-5" aria-hidden />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-bold tracking-[-0.3px]">
                    {t.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {["Campeón", t.ends_on && timeAgo(t.ends_on), t.prize]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Torneos en los que participó ---------------------------------------

const TONE: Record<"win" | "live" | "mid", { dot: string; chip: string }> = {
  win: {
    dot: "bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_20%,transparent)]",
    chip: "bg-primary text-primary-foreground",
  },
  live: {
    dot: "bg-destructive shadow-[0_0_0_4px_var(--muted)]",
    chip: "bg-destructive text-white",
  },
  mid: {
    dot: "bg-muted-foreground shadow-[0_0_0_4px_var(--muted)]",
    chip: "bg-secondary text-secondary-foreground",
  },
}

/** Línea de tiempo de los torneos del equipo, con hasta dónde llegó en cada uno. */
export function TournamentHistory({ teamId }: { teamId: string }) {
  const events = useQuery(teamEventsOptions(teamId)).data

  return (
    <Panel title="Torneos en los que participó">
      {!events ? (
        <div className="flex gap-4 p-[18px]">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] w-[170px]" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="px-[18px] py-6 text-sm text-pretty text-muted-foreground">
          Todavía no jugó ningún torneo.
        </p>
      ) : (
        <ol
          aria-label="Torneos en los que participó"
          className="flex overflow-x-auto p-[18px]"
        >
          {events.map((e) => {
            const tone = TONE[RESULT_LABEL[e.result].tone]
            return (
              <li key={e.event.id} className="w-[170px] flex-none">
                <Link
                  to="/events/$id"
                  params={{ id: e.event.id }}
                  className="flex flex-col gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex w-full items-center" aria-hidden>
                    <span
                      className={cn(
                        "size-3.5 flex-none rounded-full",
                        tone.dot
                      )}
                    />
                    <span className="h-0.5 flex-1 bg-border" />
                  </span>
                  <span className="flex flex-col gap-0.5 pr-3.5">
                    <span className="text-[13px] leading-snug font-semibold hover:underline">
                      {e.event.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {dateRange(e.event.starts_on, e.event.ends_on)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex h-[22px] w-fit items-center rounded-[calc(var(--radius)-4px)] px-2 text-[11px] font-semibold",
                      tone.chip
                    )}
                  >
                    {resultText(e.result, e.place)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
