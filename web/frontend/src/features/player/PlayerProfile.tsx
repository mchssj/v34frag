import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  BadgeCheckIcon,
  CalendarIcon,
  CrosshairIcon,
  ExternalLinkIcon,
  Gamepad2Icon,
  GitCompareIcon,
  KeyRoundIcon,
  LockIcon,
  MessageCircleIcon,
  ShieldIcon,
} from "lucide-react"
import { useState } from "react"

import { errorMessage, isApiError, isRetryable } from "@/api/errors"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { COUNTRIES } from "@/features/profile/schemas"
import { useMine } from "@/features/ranking/parts"
import { EloChart } from "./EloChart"
import {
  LEVEL_FLOORS,
  faceitUrl,
  fmtAgo,
  fmtLong,
  ladderState,
  nextLevelText,
  steamUrl,
  tilePct,
} from "./labels"
import { eloHistoryOptions, playerOptions, type PlayerDetail } from "./queries"
import { RANGES, type PlayerSearch, type Tab } from "./search"
import { PlayerTabs } from "./tabs"

// Perfil público /player/{nick} (handoff_perfil_publico). Cada sección pide lo suyo a la API.

type Props = {
  nick: string
  search: PlayerSearch
  onChange: (patch: Partial<PlayerSearch>) => void
}

export function PlayerProfile({ nick, search, onChange }: Props) {
  const q = useQuery(playerOptions(nick))

  if (q.isPending)
    return (
      <div aria-busy className="flex flex-col gap-5">
        <Skeleton className="h-[160px] rounded-xl" />
        <div className="grid gap-4 md:grid-cols-[minmax(260px,320px)_1fr]">
          <Skeleton className="h-[260px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
      </div>
    )
  if (q.isError)
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border px-5 py-10">
        <p className="text-sm text-muted-foreground">
          {isApiError(q.error, "NOT_FOUND")
            ? "No existe un jugador con ese nick."
            : errorMessage(q.error)}
        </p>
        {isRetryable(q.error) ? (
          <Button variant="outline" size="sm" onClick={() => void q.refetch()}>
            Reintentar
          </Button>
        ) : (
          <Link
            to="/ranking"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver el ranking
          </Link>
        )}
      </section>
    )

  const p = q.data
  return (
    <section className="flex flex-col gap-5">
      <PlayerHeader p={p} />
      <div className="grid items-stretch gap-4 md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <LevelCard p={p} />
        <EloCard
          nick={nick}
          level={p.level}
          range={search.range ?? 30}
          onRange={(r) => onChange({ range: r === 30 ? undefined : r })}
        />
      </div>
      <StatTiles p={p} />
      <PlayerTabs
        nick={nick}
        player={p}
        search={search}
        onTab={(tab: Tab) =>
          onChange({
            tab: tab === "resumen" ? undefined : tab,
            kind: undefined,
            result: undefined,
            page: undefined,
          })
        }
        onChange={onChange}
      />
    </section>
  )
}

function PlayerHeader({ p }: { p: PlayerDetail }) {
  const mine = useMine()
  const owner = mine.playerId === p.id
  const d = p.details
  const steam = steamUrl(d?.steam)
  const faceit = faceitUrl(d?.faceit)
  const country =
    d?.country && (COUNTRIES as readonly string[]).includes(d.country)
      ? (d.country as (typeof COUNTRIES)[number])
      : null
  const photo = p.photo_url ?? d?.avatar_url ?? null
  const [first, ...rest] = p.teams

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start gap-5 p-5">
        <Avatar className="size-24 rounded-xl after:hidden after:rounded-xl">
          {photo && <AvatarImage src={photo} alt="" className="rounded-xl" />}
          <AvatarFallback className="rounded-xl bg-secondary text-4xl font-semibold text-foreground">
            {p.alias.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-[240px] flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] font-bold tracking-[-0.6px]">
              {p.alias}
            </h1>
            {d?.country && (
              <span className="inline-flex h-[22px] items-center gap-1.5 rounded-[calc(var(--radius)-4px)] border px-1.5 text-xs font-medium">
                {country && <CountryFlag country={country} />}
                {d.country}
              </span>
            )}
            {p.has_steam && (
              <span
                title="Tiene al menos un SteamID vinculado"
                className="inline-flex h-[22px] items-center gap-1 rounded-[calc(var(--radius)-4px)] bg-secondary px-2 text-xs font-medium"
              >
                <BadgeCheckIcon aria-hidden className="size-3 text-win" />
                Verificado
              </span>
            )}
            {owner && p.privacy === "private" && (
              <span className="inline-flex h-[22px] items-center gap-1 rounded-[calc(var(--radius)-4px)] bg-secondary px-2 text-xs font-medium">
                <LockIcon aria-hidden className="size-3" />
                Perfil privado · solo tú y los admins ven tus datos
              </span>
            )}
          </div>
          {p.private ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <LockIcon aria-hidden className="size-3.5" />
              Perfil privado: nombre, país y redes ocultos
            </span>
          ) : (
            d?.real_name && (
              <span className="text-sm text-muted-foreground">
                {d.real_name}
              </span>
            )
          )}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
            {first && (
              <span className="inline-flex items-center gap-1.5">
                <ShieldIcon
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
                <Link
                  to="/teams/$id"
                  params={{ id: first.id }}
                  className="font-medium hover:underline"
                >
                  {first.name}
                </Link>
                {rest.map((t) => (
                  <Link
                    key={t.id}
                    to="/teams/$id"
                    params={{ id: t.id }}
                    className="text-muted-foreground hover:underline"
                  >
                    + {t.name}
                  </Link>
                ))}
              </span>
            )}
            {d?.game_role && (
              <span className="inline-flex items-center gap-1.5">
                <CrosshairIcon
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
                {d.game_role}
                <span className="text-muted-foreground">
                  · puesto preferido
                </span>
              </span>
            )}
            {d?.joined_at && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <CalendarIcon aria-hidden className="size-3.5" />
                Miembro desde {fmtLong(d.joined_at)}
                {d.last_seen && ` · visto ${fmtAgo(d.last_seen)}`}
              </span>
            )}
          </div>
          {(steam || d?.discord || faceit) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {steam && (
                <SocialLink
                  href={steam}
                  icon={<Gamepad2Icon aria-hidden className="size-3" />}
                >
                  Steam
                </SocialLink>
              )}
              {d?.discord && (
                <span
                  title="Discord"
                  className="inline-flex h-[26px] items-center gap-1.5 rounded-lg border px-2.5 text-xs"
                >
                  <MessageCircleIcon aria-hidden className="size-3" />
                  {d.discord}
                </span>
              )}
              {faceit && (
                <SocialLink
                  href={faceit}
                  icon={<ExternalLinkIcon aria-hidden className="size-3" />}
                >
                  FACEIT
                </SocialLink>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {owner ? (
            <Link
              to="/profile"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-8 px-3 text-[13px]"
              )}
            >
              Editar perfil
            </Link>
          ) : (
            <Link
              to="/players/compare"
              search={{ b: p.alias }}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-8 gap-1.5 px-3 text-[13px]"
              )}
            >
              <GitCompareIcon aria-hidden className="size-3.5" />
              Comparar
            </Link>
          )}
        </div>
      </div>
      {!p.has_account && (
        <div className="flex flex-wrap items-center gap-3 rounded-b-xl border-t bg-muted px-5 py-3 text-[13px]">
          <KeyRoundIcon aria-hidden className="size-4" />
          <span className="flex-1">
            ¿Es tu perfil? Genera un código y escribe{" "}
            <code className="rounded-[4px] border bg-background px-1.5 py-px font-mono">
              !claim
            </code>{" "}
            en el servidor para vincularlo.
          </span>
          <Link
            to="/profile/link"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-7 px-2.5 text-xs"
            )}
          >
            Generar código
          </Link>
        </div>
      )}
    </div>
  )
}

function SocialLink({
  href,
  icon,
  children,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-[26px] items-center gap-1.5 rounded-lg border bg-background px-2.5 text-xs hover:bg-muted"
    >
      {icon}
      {children}
    </a>
  )
}

const LEVEL_BG = (l: number) =>
  l >= 10
    ? "bg-primary text-primary-foreground"
    : l >= 8
      ? "bg-sidebar-primary text-primary-foreground"
      : l >= 4
        ? "bg-foreground text-background"
        : "bg-muted-foreground text-background"

function LevelCard({ p }: { p: PlayerDetail }) {
  const level = p.level
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <span className="text-sm font-semibold">Nivel</span>
      {level === null || p.elo === null ? (
        <p className="text-[13px] text-muted-foreground">
          Todavía no jugó mixes en el servidor.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                "grid size-[60px] place-items-center rounded-xl font-mono text-[28px] font-bold",
                LEVEL_BG(level)
              )}
            >
              {level}
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-mono text-[30px] leading-none font-bold tracking-[-1px] tabular-nums">
                {p.elo}
              </span>
              {p.peak_elo !== null && (
                <span className="text-xs text-muted-foreground">
                  Máximo de la temporada {p.peak_elo}
                </span>
              )}
            </span>
          </div>
          <div
            className="grid grid-cols-10 gap-[3px]"
            aria-label={`Nivel ${level} de 10`}
          >
            {LEVEL_FLOORS.map((_, i) => {
              const s = ladderState(i + 1, level)
              return (
                <span
                  key={i}
                  title={`Nivel ${i + 1}`}
                  className={cn(
                    "h-2 rounded-[2px]",
                    s === "done"
                      ? "bg-foreground"
                      : s === "current"
                        ? "bg-primary"
                        : "bg-muted"
                  )}
                />
              )
            })}
          </div>
          <span className="text-[13px] text-muted-foreground">
            {nextLevelText(level, p.elo)}
          </span>
        </>
      )}
      <div className="mt-auto grid grid-cols-2 gap-2.5 border-t pt-3.5">
        <span className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Victorias</span>
          <span className="font-mono text-base font-semibold text-win tabular-nums">
            {p.wins ?? 0}
          </span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Derrotas</span>
          <span className="font-mono text-base font-semibold text-destructive tabular-nums">
            {p.losses ?? 0}
          </span>
        </span>
      </div>
    </div>
  )
}

function EloCard({
  nick,
  level,
  range,
  onRange,
}: {
  nick: string
  level: number | null
  range: 10 | 20 | 30
  onRange: (r: 10 | 20 | 30) => void
}) {
  const q = useQuery(eloHistoryOptions(nick, range))
  const [label, setLabel] = useState<string | null>(null)
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm font-semibold">Evolución de ELO</span>
        <span className="min-h-4 font-mono text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <div
          role="group"
          aria-label="Partidas del gráfico"
          className="inline-flex h-7 gap-0.5 rounded-lg bg-muted p-0.5"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => onRange(r)}
              className={cn(
                "h-6 rounded-[calc(var(--radius)-4px)] px-2 text-xs font-medium text-muted-foreground",
                range === r &&
                  "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/.1)]"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {q.isPending ? (
        <Skeleton className="min-h-[200px] flex-1" />
      ) : (
        <EloChart
          points={q.data ?? []}
          level={level}
          floor={level === null ? null : LEVEL_FLOORS[level - 1]}
          onHover={setLabel}
        />
      )}
    </div>
  )
}

function StatTiles({ p }: { p: PlayerDetail }) {
  const s = p.stats
  const wins = s?.wins ?? p.wins ?? 0
  const losses = s?.losses ?? p.losses ?? 0
  const played = wins + losses
  const wr = played ? (wins / played) * 100 : null
  const maps = s?.maps ?? p.maps
  const tiles = [
    {
      label: "Rating",
      value: s?.rating?.toFixed(2),
      pct: tilePct(s?.rating, 2),
      note: "Partidas en el servidor",
    },
    {
      label: "K/D",
      value: s?.kd?.toFixed(2),
      pct: tilePct(s?.kd, 2.5),
      note: "Kills por muerte",
    },
    {
      label: "HS %",
      value: s?.hs == null ? undefined : `${Math.round(s.hs)}%`,
      pct: tilePct(s?.hs, 100),
      note: "Kills con headshot",
    },
    {
      label: "ADR",
      value: s?.adr == null ? undefined : String(Math.round(s.adr)),
      pct: tilePct(s?.adr, 150),
      note: "Daño por ronda",
    },
    {
      label: "% Victorias",
      value: wr === null ? undefined : `${Math.round(wr)}%`,
      pct: tilePct(wr, 100),
      note: `${wins} de ${played}`,
    },
    {
      label: "Partidas",
      value: maps == null ? undefined : String(maps),
      pct: tilePct(maps, 200),
      note: "Mixes, PCW y torneos",
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3.5"
        >
          <span className="text-xs text-muted-foreground">{t.label}</span>
          <span className="font-mono text-[22px] font-semibold tracking-[-0.5px] tabular-nums">
            {t.value ?? "—"}
          </span>
          <span className="h-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full bg-foreground"
              style={{ width: `${t.pct}%` }}
            />
          </span>
          <span className="text-[11px] text-muted-foreground">{t.note}</span>
        </div>
      ))}
    </div>
  )
}
