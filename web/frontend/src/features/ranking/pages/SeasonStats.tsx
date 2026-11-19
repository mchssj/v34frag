import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon, CalendarIcon, TimerIcon } from "lucide-react"
import type { ReactNode } from "react"

import type { Schemas } from "@/api/client"
import { isApiError } from "@/api/errors"
import { QueryErrorMessage } from "@/components/brand/QueryState"
import { StatTile } from "@/components/brand/StatTile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { dateLabel, mapLabel } from "@/features/player/recap/types"
import { seasonSummaryOptions } from "../api/queries"

// Estadísticas de la temporada (bitácora 2026-11-19-estadisticas-de-temporada): la web y el matchmaking, sin
// rankings de jugadores (Kyan, 2026-11-19; lo de cada jugador está en su recap). Públicas al cerrar la
// temporada; con la temporada activa, solo para admins y calculadas al momento.

type Summary = Schemas["SeasonSummary"]

const nf = (n: number, d = 0) =>
  n.toLocaleString("es-AR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
/** 95 → "1:35". */
const wait = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export function SeasonStats({ number }: { number: number }) {
  const q = useQuery(seasonSummaryOptions(number))
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/ranking">
          <ArrowLeftIcon /> Ranking
        </Link>
      </Button>
      {q.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : q.isError ? (
        <Card variant="outline" className="px-4 py-10 text-center">
          <QueryErrorMessage
            error={q.error}
            onRetry={q.refetch}
            message={
              isApiError(q.error, "NOT_FOUND")
                ? "Las estadísticas de la temporada se publican cuando termina."
                : undefined
            }
          />
        </Card>
      ) : (
        <Content s={q.data} />
      )}
    </div>
  )
}

function Content({ s }: { s: Summary }) {
  const { season, games: g, matchmaking: mm, community: c, when } = s
  const peak = when.by_hour.reduce<(typeof when.by_hour)[number] | null>(
    (a, b) => (!a || b.matches > a.matches ? b : a),
    null
  )
  const cancelMax = mm.cancel_reasons[0]?.count ?? 1
  return (
    <>
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs font-semibold tracking-[1.5px] text-primary uppercase">
            Estadísticas de la temporada
          </span>
          <h1 className="text-[clamp(26px,4vw,38px)] leading-tight font-bold tracking-[-1px]">
            {season.name}
          </h1>
          <span className="text-sm text-muted-foreground">
            Del {dateLabel(season.starts_at)} al{" "}
            {dateLabel(season.closed_at ?? season.until)}
            {s.live && " (hasta ahora)"}
          </span>
        </div>
        {s.live ? (
          <Badge
            variant="live"
            shape="pill"
            size="md"
            className="gap-1.5 font-mono text-[11px] font-semibold sm:ml-auto"
          >
            <span
              aria-hidden
              className="size-1.5 animate-live rounded-full bg-current"
            />
            EN VIVO · SOLO ADMINS
          </Badge>
        ) : (
          <Badge
            variant="muted"
            shape="pill"
            size="md"
            className="font-mono text-[11px] font-semibold sm:ml-auto"
          >
            CERRADA
          </Badge>
        )}
      </header>
      {s.live && (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          La temporada sigue en curso: estas cifras se calculan al momento y
          solo las ven los admins. Al cerrarla se guarda la foto y la ve todo el
          mundo.
        </p>
      )}

      <Section title="Mixes" aside="los que contaron para el ranking">
        <Tiles>
          <StatTile label="Mixes" value={nf(g.mixes)} />
          <StatTile label="Jugadores" value={nf(g.players)} />
          <StatTile label="Rondas" value={nf(g.rounds)} />
          <StatTile label="Horas de juego" value={`~${nf(g.hours)}`} />
          <StatTile
            label="Duración promedio"
            value={g.avg_minutes !== null ? `${g.avg_minutes} min` : "—"}
          />
          <StatTile label="Kills" value={nf(g.kills)} />
          <StatTile label="% HS" value={`${g.hs_pct}%`} />
          <StatTile label="Aces" value={nf(g.aces)} />
          <StatTile label="4K" value={nf(g.k4)} />
          <StatTile label="Bombas plantadas" value={nf(g.plants)} />
          <StatTile label="Bombas desactivadas" value={nf(g.defuses)} />
        </Tiles>
      </Section>

      <Section title="Matchmaking">
        <Tiles>
          <StatTile label="Búsquedas" value={nf(mm.queue_joins)} />
          <StatTile label="Cuentas que buscaron" value={nf(mm.queue_players)} />
          <StatTile
            label="Espera mediana"
            value={mm.wait_median_s !== null ? wait(mm.wait_median_s) : "—"}
          />
          <StatTile label="Salas armadas" value={nf(mm.lobbies)} />
          <StatTile label="Salas jugadas" value={nf(mm.played)} />
          <StatTile label="Salas canceladas" value={nf(mm.cancelled)} />
          <StatTile label="Llegaron en grupo" value={`${mm.party_pct}%`} />
          <StatTile label="Abandonos" value={nf(mm.abandons)} />
          <StatTile label="Reemplazos" value={nf(mm.replacements)} />
          <StatTile label="Reportes" value={nf(mm.reports)} />
          <StatTile label="Sanciones" value={nf(mm.penalties)} />
          <StatTile label="Baneos del MM" value={nf(mm.bans)} />
        </Tiles>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card
            variant="outline"
            radius="xl"
            className="flex flex-col gap-3 p-5"
          >
            <SubTitle aside={`${nf(mm.matched + mm.left)} búsquedas`}>
              Cómo terminó cada búsqueda
            </SubTitle>
            <Share
              label="Llegó a una sala"
              value={mm.matched}
              total={mm.matched + mm.left}
            />
            <Share
              label="Salió sin sala"
              value={mm.left}
              total={mm.matched + mm.left}
              muted
            />
            <SubTitle aside={`${nf(mm.lobbies)} salas`}>
              Cómo terminó cada sala
            </SubTitle>
            <Share label="Se jugó" value={mm.played} total={mm.lobbies} />
            <Share
              label="Se canceló"
              value={mm.cancelled}
              total={mm.lobbies}
              muted
            />
          </Card>
          <Card
            variant="outline"
            radius="xl"
            className="flex flex-col gap-3 p-5"
          >
            <SubTitle aside="salas canceladas">Por qué se cancelaron</SubTitle>
            {mm.cancel_reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguna sala cancelada.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {mm.cancel_reasons.map((r) => (
                  <li key={r.reason} className="flex flex-col gap-1">
                    <span className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0">{r.reason}</span>
                      <span className="font-mono tabular-nums">{r.count}</span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary/80"
                        style={{ width: `${(r.count / cancelMax) * 100}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Section>

      <Section title="Cuándo se juega" aside="hora de Argentina">
        <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
          <Card
            variant="outline"
            radius="xl"
            className="flex flex-col gap-3 p-5"
          >
            <SubTitle
              aside={
                peak && peak.matches > 0
                  ? `más mixes a las ${peak.hour} h`
                  : undefined
              }
            >
              Mixes por hora de inicio
            </SubTitle>
            <Bars
              items={when.by_hour.map((h) => ({
                key: String(h.hour),
                label: h.hour % 3 === 0 ? `${h.hour}` : "",
                value: h.matches,
                tip: `${h.hour}:00 a ${h.hour}:59 · ${h.matches} ${h.matches === 1 ? "mix" : "mixes"}`,
              }))}
            />
          </Card>
          <Card
            variant="outline"
            radius="xl"
            className="flex flex-col gap-3 p-5"
          >
            <SubTitle>Mixes por día de la semana</SubTitle>
            <Bars
              items={when.by_weekday.map((d) => ({
                key: String(d.day),
                label: WEEKDAYS[d.day - 1],
                value: d.matches,
                tip: `${WEEKDAYS[d.day - 1]} · ${d.matches} ${d.matches === 1 ? "mix" : "mixes"}`,
              }))}
            />
          </Card>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {when.busiest_day && (
            <Fact icon={<CalendarIcon />} label="El día con más mixes">
              {dateLabel(when.busiest_day.date)}: {when.busiest_day.matches}{" "}
              mixes
            </Fact>
          )}
          {s.longest && (
            <Fact icon={<TimerIcon />} label="El mix más largo">
              <Link
                to="/match/$id"
                params={{ id: s.longest.match_id }}
                className="underline-offset-4 hover:underline"
              >
                {s.longest.score1}–{s.longest.score2}
                {s.longest.map && (
                  <span className="capitalize">
                    {" "}
                    en {mapLabel(s.longest.map)}
                  </span>
                )}
              </Link>
              <span className="block text-xs font-normal text-muted-foreground">
                {dateLabel(s.longest.date)}
              </span>
            </Fact>
          )}
        </div>
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card variant="outline" radius="xl" className="flex flex-col gap-3 p-5">
          <SubTitle aside="mixes · rondas promedio">Mapas</SubTitle>
          <Ranked
            items={s.maps.map((m) => ({
              key: m.name,
              label: <span className="capitalize">{mapLabel(m.name)}</span>,
              value: m.matches,
              note: `${m.matches} · ${nf(m.avg_rounds, 1)} r`,
            }))}
          />
        </Card>
        <Card variant="outline" radius="xl" className="flex flex-col gap-3 p-5">
          <SubTitle aside="mixes · % del total">Servidores</SubTitle>
          <Ranked
            items={s.servers.map((sv) => ({
              key: sv.name,
              label: sv.name,
              value: sv.matches,
              note: `${sv.matches} · ${pct(sv.matches, g.mixes)}%`,
            }))}
          />
        </Card>
      </div>

      <Section title="Comunidad" aside="en la web durante la temporada">
        <Tiles>
          <StatTile label="Cuentas nuevas" value={nf(c.new_accounts)} />
          <StatTile label="Visitas a perfiles" value={nf(c.profile_visits)} />
          <StatTile label="Comentarios en perfiles" value={nf(c.comments)} />
          <StatTile label="Amistades nuevas" value={nf(c.friendships)} />
          <StatTile label="Clips" value={nf(c.clips)} />
          <StatTile label="Clips con video" value={nf(c.clips_video)} />
          <StatTile label="Demos subidas" value={nf(c.demos)} />
          <StatTile label="PCW jugados" value={nf(c.pcw)} />
          <StatTile label="Partidas oficiales" value={nf(c.official)} />
          <StatTile label="Torneos" value={nf(c.tournaments)} />
        </Tiles>
      </Section>
    </>
  )
}

function Section({
  title,
  aside,
  children,
}: {
  title: string
  aside?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-xs font-semibold tracking-[1.5px] text-primary uppercase">
          {title}
        </h2>
        {aside && (
          <span className="text-xs text-muted-foreground">{aside}</span>
        )}
      </div>
      {children}
    </section>
  )
}

function SubTitle({
  children,
  aside,
}: {
  children: ReactNode
  aside?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
    </div>
  )
}

function Tiles({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {children}
    </div>
  )
}

/** Una parte de un total, con su barra: "Llegó a una sala 840 · 67%". */
function Share({
  label,
  value,
  total,
  muted,
}: {
  label: string
  value: number
  total: number
  muted?: boolean
}) {
  const p = pct(value, total)
  return (
    <div className="flex flex-col gap-1">
      <span className="flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {nf(value)} · {p}%
        </span>
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <span
          className={
            muted
              ? "block h-full rounded-full bg-muted-foreground/50"
              : "block h-full rounded-full bg-primary"
          }
          style={{ width: `${p}%` }}
        />
      </span>
    </div>
  )
}

/** Barras verticales finas de una sola serie, con un globo por barra. */
function Bars({
  items,
}: {
  items: { key: string; label: string; value: number; tip: string }[]
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="list"
        aria-label="Mixes"
        className="flex h-36 items-end gap-[2px] border-b"
      >
        {items.map((i) => (
          <Tooltip key={i.key}>
            <TooltipTrigger asChild>
              <div
                role="listitem"
                tabIndex={0}
                aria-label={i.tip}
                className="group flex h-full flex-1 cursor-default items-end outline-none"
              >
                <span
                  className="block w-full rounded-t-[4px] bg-primary/80 transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
                  style={{
                    height: `${(i.value / max) * 100}%`,
                    minHeight: i.value ? 2 : 0,
                  }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{i.tip}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div aria-hidden className="flex gap-[2px]">
        {items.map((i) => (
          <span
            key={i.key}
            className="flex-1 text-center font-mono text-[10.5px] text-muted-foreground tabular-nums"
          >
            {i.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Lista con barras horizontales, de más a menos. */
function Ranked({
  items,
}: {
  items: { key: string; label: ReactNode; value: number; note: string }[]
}) {
  const max = items[0]?.value || 1
  if (!items.length)
    return <p className="text-sm text-muted-foreground">Sin datos.</p>
  return (
    <ul className="flex flex-col gap-1">
      {items.map((i) => (
        <li
          key={i.key}
          className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3 py-1"
        >
          <span className="truncate text-sm font-medium">{i.label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary/80"
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </span>
          <span className="w-24 text-right font-mono text-xs tabular-nums">
            {i.note}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <Card
      variant="outline"
      radius="xl"
      className="flex items-start gap-3 p-4 [&>svg]:mt-0.5 [&>svg]:size-5 [&>svg]:text-primary"
    >
      {icon}
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-semibold">{children}</span>
      </span>
    </Card>
  )
}
