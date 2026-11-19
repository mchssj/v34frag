import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { BarChart3Icon, MedalIcon, SparklesIcon } from "lucide-react"
import { type ReactNode } from "react"
import { EmptyState } from "@/components/brand/EmptyState"
import { QueryState } from "@/components/brand/QueryState"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { bestSeasonId } from "../../lib/labels"
import { seasonsOptions } from "../../api/queries"
import type { PlayerSeason } from "../../types"
import { SeasonMedal } from "@/features/medals/Medal"
import { LevelBadge } from "@/components/brand/LevelBadge"
import { Button } from "@/components/ui/button"
import { useMe } from "@/auth/queries"
import { currentSeasonOptions } from "@/features/ranking/api/queries"

// ---------- Temporadas ----------

export function Seasons({ nick }: { nick: string }) {
  const q = useQuery(seasonsOptions(nick))
  // La temporada en curso solo la ven los admins (replanteo 129): su recap y las estadísticas, en vivo.
  const admin = useMe().data?.role === "admin"
  const current = useQuery({ ...currentSeasonOptions, enabled: admin }).data
  const live =
    admin && current ? (
      <LiveCard nick={nick} number={current.number} name={current.name} />
    ) : null
  return (
    <QueryState q={q}>
      {(items) => {
        if (!items.length && live)
          return (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-3 pt-2.5">
              {live}
            </div>
          )
        if (!items.length)
          return (
            <Card
              variant="outline"
              className="flex min-h-[396px] flex-col pb-6"
            >
              <EmptyState
                icon={MedalIcon}
                title="Todavía no terminó ninguna temporada"
                className="flex-none pt-10"
              >
                Al cierre de cada temporada se guarda acá su puesto, su medalla
                y su ELO final.
              </EmptyState>
              {/* Tarjetas fantasma: dicen qué va a aparecer. */}
              <div
                aria-hidden
                className="mx-auto grid w-full max-w-[820px] gap-3 px-5 sm:grid-cols-3"
              >
                {[60, 50, 65].map((w) => (
                  <div
                    key={w}
                    className="flex items-center gap-3 rounded-xl border-[1.5px] border-dashed p-4 opacity-80"
                  >
                    <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-muted font-mono text-lg text-muted-foreground">
                      ?
                    </span>
                    <span className="flex flex-1 flex-col gap-1.5">
                      <i
                        className="block h-2.5 rounded bg-muted"
                        style={{ width: `${w}%` }}
                      />
                      <i
                        className="block h-2.5 rounded bg-muted"
                        style={{ width: `${w + 20}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )
        const best = bestSeasonId(items)
        return (
          <div className="grid min-h-[396px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-3 pt-2.5">
            {live}
            {items.map((s) => (
              <SeasonCard
                key={s.season.id}
                s={s}
                best={s.season.id === best}
                nick={nick}
              />
            ))}
          </div>
        )
      }}
    </QueryState>
  )
}

/** Solo admins: la temporada activa, con el recap y las estadísticas calculados al momento. */
function LiveCard({
  nick,
  number,
  name,
}: {
  nick: string
  number: number
  name: string
}) {
  return (
    <Card variant="outline" className="flex flex-col gap-3 border-dashed p-4">
      <span className="flex items-center gap-2">
        <span className="truncate text-[15px] font-semibold">{name}</span>
        <Badge
          variant="live"
          shape="pill"
          size="sm"
          className="ml-auto font-mono text-[10px] font-semibold"
        >
          EN VIVO · SOLO ADMINS
        </Badge>
      </span>
      <p className="text-xs text-muted-foreground">
        Todavía no terminó: los jugadores ven su recap y las estadísticas cuando
        cierra.
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link
            to="/player/$nick/recap/$season"
            params={{ nick, season: String(number) }}
          >
            <SparklesIcon /> Recap en vivo
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/season/$number" params={{ number }}>
            <BarChart3Icon /> Estadísticas
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function SeasonCard({
  s,
  best,
  nick,
}: {
  s: PlayerSeason
  best: boolean
  nick: string
}) {
  const played = s.wins + s.losses
  const wr = played ? Math.round((s.wins / played) * 100) : 0
  return (
    <Card
      variant="outline"
      className={cn(
        "relative flex flex-col gap-3.5 p-4",
        best && "border-amber-400/70 ring-3 ring-amber-400/15"
      )}
    >
      {best && (
        <span className="absolute -top-[11px] left-3.5 inline-flex h-[22px] items-center gap-1 rounded-full bg-amber-400 px-2 text-[11px] font-semibold text-amber-950 shadow-[0_0_0_3px_var(--background)]">
          ★ Mejor temporada
        </span>
      )}
      <div className="flex items-center gap-3">
        {s.medal?.design ? (
          <SeasonMedal medal={s.medal} size={52} />
        ) : (
          <span
            aria-hidden
            className="grid size-[52px] shrink-0 place-items-center rounded-full border bg-muted text-lg text-muted-foreground"
          >
            —
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">
            {s.season.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {s.medal ? `Medalla: ${s.medal.name}` : "Sin medalla"}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 flex-col items-end">
          {s.eligible && s.rank !== null ? (
            <>
              <span className="font-mono text-2xl leading-none font-semibold tracking-[-0.5px] tabular-nums">
                #{s.rank}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Puesto final
              </span>
            </>
          ) : (
            <Badge
              variant="muted"
              shape="pill"
              size="md"
              className="text-[11px] font-semibold"
            >
              No clasificó
            </Badge>
          )}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <SeasonKv label="ELO final">{s.elo}</SeasonKv>
        <SeasonKv label="Pico">{s.peak_elo}</SeasonKv>
        <SeasonKv label="Nivel">
          {s.level !== null ? <LevelBadge level={s.level} size={22} /> : "—"}
        </SeasonKv>
      </dl>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {s.matches} {s.matches === 1 ? "mix" : "mixes"} ·{" "}
            <b className="font-semibold text-win">{s.wins} V</b> –{" "}
            <b className="font-semibold text-destructive">{s.losses} D</b>
          </span>
          <span className="font-mono tabular-nums">{wr}%</span>
        </div>
        <div
          role="img"
          aria-label={`${wr}% de victorias`}
          className="flex h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <span className="bg-win" style={{ width: `${wr}%` }} />
          {played > 0 && (
            <span
              className="bg-destructive/70"
              style={{ width: `${100 - wr}%` }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {s.has_recap && (
          <Button asChild size="sm">
            <Link
              to="/player/$nick/recap/$season"
              params={{ nick, season: String(s.season.number) }}
            >
              <SparklesIcon /> Recap
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link to="/season/$number" params={{ number: s.season.number }}>
            <BarChart3Icon /> Estadísticas de la temporada
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function SeasonKv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[15px] font-semibold tabular-nums">
        {children}
      </dd>
    </div>
  )
}
