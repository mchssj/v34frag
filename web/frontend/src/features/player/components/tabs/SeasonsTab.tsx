import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { MedalIcon } from "lucide-react"
import { type ReactNode } from "react"
import { EmptyState } from "@/components/brand/EmptyState"
import { bestSeasonId } from "../../lib/labels"
import { seasonsOptions } from "../../api/queries"
import type { PlayerSeason } from "../../types"
import { card, Loaded } from "./shared"

// ---------- Temporadas ----------

export function Seasons({ nick }: { nick: string }) {
  const q = useQuery(seasonsOptions(nick))
  return (
    <Loaded q={q}>
      {(items) => {
        if (!items.length)
          return (
            <div className={cn(card, "flex min-h-[396px] flex-col pb-6")}>
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
            </div>
          )
        const best = bestSeasonId(items)
        return (
          <div className="grid min-h-[396px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] content-start gap-3 pt-2.5">
            {items.map((s) => (
              <SeasonCard key={s.season.id} s={s} best={s.season.id === best} />
            ))}
          </div>
        )
      }}
    </Loaded>
  )
}

function SeasonCard({ s, best }: { s: PlayerSeason; best: boolean }) {
  const played = s.wins + s.losses
  const wr = played ? Math.round((s.wins / played) * 100) : 0
  return (
    <div
      className={cn(
        card,
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
        <span
          aria-hidden
          className={cn(
            "grid size-[52px] shrink-0 place-items-center rounded-full border text-[26px]",
            s.medal
              ? "border-amber-400/45 bg-amber-400/15"
              : "bg-muted text-lg text-muted-foreground"
          )}
        >
          {s.medal?.icon ?? "—"}
        </span>
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
            <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
              No clasificó
            </span>
          )}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <SeasonKv label="ELO final">{s.elo}</SeasonKv>
        <SeasonKv label="Pico">{s.peak_elo}</SeasonKv>
        <SeasonKv label="Nivel">
          {s.level !== null ? (
            <span className="inline-grid h-[22px] min-w-[22px] place-items-center rounded-md bg-foreground px-1 text-[11px] text-background">
              {s.level}
            </span>
          ) : (
            "—"
          )}
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
    </div>
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
