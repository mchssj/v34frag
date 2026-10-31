import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import {
  CalendarIcon,
  ClockIcon,
  CrosshairIcon,
  FlagIcon,
  MedalIcon,
  PencilIcon,
  QuoteIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react"
import { type ReactNode } from "react"
import { CountryFlag } from "@/components/brand/CountryFlag"
import { Button } from "@/components/ui/button"
import { COUNTRIES } from "@/features/profile/lib/schemas"
import { useTeamLogos } from "@/features/teams/api/queries"
import { Soon, TeamCrest } from "@/features/teams/components/ui"
import { fmtAgo, fmtLong, fmtMonthShort } from "../../lib/labels"
import { medalsOptions, titlesOptions } from "../../api/queries"
import type { PlayerDetail, Title } from "../../types"
import { card, Loaded } from "./shared"

// ---------- Bio y torneos ----------

export function Bio({
  nick,
  player,
  owner,
}: {
  nick: string
  player: PlayerDetail
  owner: boolean
}) {
  const d = player.details
  const bio = player.bio?.trim()
  const country =
    d?.country && (COUNTRIES as readonly string[]).includes(d.country)
      ? (d.country as (typeof COUNTRIES)[number])
      : null
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)]">
        <div className={cn(card, "flex flex-col items-start gap-3 p-5")}>
          <QuoteIcon
            aria-hidden
            className={cn(
              "size-7",
              bio ? "text-primary" : "text-muted-foreground/50"
            )}
          />
          {bio ? (
            <>
              <p className="max-w-[62ch] text-[15px] leading-relaxed text-pretty whitespace-pre-line">
                {bio}
              </p>
              <span className="text-[13px] text-muted-foreground">
                — {player.alias}
              </span>
            </>
          ) : (
            <>
              <p className="text-[15px] text-muted-foreground">
                Todavía no tiene biografía.
              </p>
              {/* La biografía hoy solo la edita un admin (pedido al backend). */}
              {owner && (
                <Soon label="Escribir tu biografía · Próximamente">
                  <Button variant="outline" size="sm" disabled>
                    <PencilIcon aria-hidden />
                    Escribir biografía
                  </Button>
                </Soon>
              )}
            </>
          )}
        </div>
        <dl className={cn(card, "flex flex-col px-4 py-1.5")}>
          <Fact icon={FlagIcon} label="País">
            {d?.country ? (
              <span className="inline-flex items-center gap-1.5">
                {country && <CountryFlag country={country} />}
                {d.country}
              </span>
            ) : null}
          </Fact>
          <Fact icon={CrosshairIcon} label="Rol">
            {d?.game_role}
          </Fact>
          <Fact icon={CalendarIcon} label="Miembro desde">
            {d?.joined_at && fmtMonthShort(d.joined_at)}
          </Fact>
          <Fact icon={ClockIcon} label="Última conexión">
            {d?.last_seen && fmtAgo(d.last_seen)}
          </Fact>
        </dl>
      </div>
      <Palmares nick={nick} />
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 border-b py-2.5 text-[13px] last:border-b-0">
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      <dt className="flex-1 text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  )
}

/**
 * Vitrina: los títulos de torneos de la plataforma (campeón o subcampeón) y las medallas que
 * entregan los admins. Cada bloque aparece solo si tiene algo.
 */
function Palmares({ nick }: { nick: string }) {
  const titles = useQuery(titlesOptions(nick))
  const medals = useQuery(medalsOptions(nick))
  const withLogo = useTeamLogos((titles.data ?? []).map((t) => t.team))
  return (
    <Loaded q={titles}>
      {(won) => (
        <Loaded q={medals}>
          {(given) => {
            const empty = !won.length && !given.length
            const summary = [
              won.length &&
                `${won.length} ${won.length === 1 ? "título" : "títulos"} de torneo`,
              given.length &&
                `${given.length} ${given.length === 1 ? "medalla" : "medallas"}`,
            ]
              .filter(Boolean)
              .join(" · ")
            return (
              <section
                aria-label="Palmarés"
                className={cn(
                  card,
                  "flex flex-col gap-4 p-[18px]",
                  !empty &&
                    "bg-gradient-to-b from-amber-400/[0.07] via-card to-card"
                )}
              >
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h3 className="text-[15px] font-semibold">Palmarés</h3>
                  <span className="text-[12.5px] text-muted-foreground">
                    {empty ? "Todavía sin títulos" : summary}
                  </span>
                </div>
                {empty ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                    <TrophySlot icon={TrophyIcon}>
                      Gana un torneo con tu equipo
                    </TrophySlot>
                    <TrophySlot icon={MedalIcon}>
                      Las medallas las entregan los admins
                    </TrophySlot>
                  </div>
                ) : (
                  <>
                    {won.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Torneos
                        </span>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                          {won.map((t) => (
                            <TitleCard
                              key={`${t.event.id}-${t.result}`}
                              t={{ ...t, team: withLogo(t.team) }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {given.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Medallas
                        </span>
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                          {given.map((m) => (
                            <div
                              key={`${m.title}-${m.icon}`}
                              className={cn(
                                "flex items-center gap-2.5 rounded-[10px] bg-muted",
                                won.length ? "p-2.5" : "p-3.5"
                              )}
                            >
                              <span
                                aria-hidden
                                className={
                                  won.length ? "text-xl" : "text-[26px]"
                                }
                              >
                                {m.icon ?? "🏅"}
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className="text-[12.5px] font-semibold break-words">
                                  {m.title}
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                                  ×{m.count}
                                  {m.last_at &&
                                    ` · ${fmtMonthShort(m.last_at)}`}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            )
          }}
        </Loaded>
      )}
    </Loaded>
  )
}

function TitleCard({ t }: { t: Title }) {
  const champion = t.result === "champion"
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5">
      <span
        className={cn(
          "grid size-11 place-items-center rounded-xl",
          champion
            ? "bg-amber-400/20 text-amber-500"
            : "bg-slate-400/20 text-slate-500 dark:text-slate-300"
        )}
      >
        <TrophyIcon aria-hidden className="size-[22px]" />
      </span>
      <span
        className={cn(
          "text-[11px] font-bold tracking-[0.06em] uppercase",
          champion ? "text-amber-500" : "text-slate-500 dark:text-slate-300"
        )}
      >
        {champion ? "Campeón" : "Subcampeón"}
      </span>
      <Link
        to="/events/$id"
        params={{ id: t.event.id }}
        className="text-sm font-semibold hover:underline"
      >
        {t.event.name}
      </Link>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <TeamCrest team={t.team} size="xs" />
        con {t.team.name}
        {t.at && ` · ${fmtLong(t.at)}`}
      </span>
    </div>
  )
}

function TrophySlot({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <div className="flex min-h-[132px] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed p-3.5 text-center text-[12.5px] text-muted-foreground">
      <span className="grid size-11 place-items-center rounded-xl bg-muted">
        <Icon aria-hidden className="size-[22px]" />
      </span>
      {children}
    </div>
  )
}
