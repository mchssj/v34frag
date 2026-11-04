import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { MedalImage } from "@/components/brand/MedalImage"
import { QueryState } from "@/components/brand/QueryState"
import { Card } from "@/components/ui/card"
import { seasonShort, useMedalsByKey } from "@/lib/medals"
import { KeyPlays } from "../KeyPlays"
import { adjustmentLabel, fmtDay, matchTitle, resultOf } from "../../lib/labels"
import {
  adjustmentsOptions,
  medalsOptions,
  recentMatchesOptions,
} from "../../api/queries"
import type { PlayerDetail } from "../../types"
import { Delta, RESULT_CHIP, useOpenMatch } from "./shared"

// ---------- Resumen ----------

export function Summary({
  nick,
  player,
  onAll,
}: {
  nick: string
  player: PlayerDetail
  onAll: () => void
}) {
  const recent = useQuery(recentMatchesOptions(nick))
  const medals = useQuery(medalsOptions(nick))
  const adjustments = useQuery(adjustmentsOptions(nick))
  const catalog = useMedalsByKey()
  const open = useOpenMatch()

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card variant="outline" className="overflow-hidden">
        <div className="flex items-center border-b px-4 py-3.5 text-sm font-semibold">
          Partidas recientes
          <button
            type="button"
            onClick={onAll}
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todas
          </button>
        </div>
        <QueryState q={recent}>
          {(items) =>
            items.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Todavía no jugó partidas en el servidor.
              </p>
            ) : (
              items.map((m) => {
                const t = matchTitle(m)
                const r = resultOf(m.won)
                return (
                  <button
                    key={m.match_id}
                    type="button"
                    onClick={() => open(m)}
                    className="grid w-full grid-cols-[24px_minmax(0,1fr)_64px_56px_52px] items-center gap-3 border-b px-4 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-muted max-sm:grid-cols-[24px_minmax(0,1fr)_44px_48px] max-sm:gap-2"
                  >
                    <span
                      className={cn(
                        "grid size-[22px] place-items-center rounded-[5px] font-mono text-[11px] font-semibold",
                        RESULT_CHIP[r]
                      )}
                    >
                      {r}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{t.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t.sub}
                      </span>
                    </span>
                    <span className="font-mono text-muted-foreground tabular-nums max-sm:hidden">
                      {m.kills ?? 0}-{m.deaths ?? 0}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {m.rating?.toFixed(2) ?? "—"}
                    </span>
                    <span className="text-right font-mono text-xs font-semibold tabular-nums">
                      <Delta v={m.elo_delta} />
                    </span>
                  </button>
                )
              })
            )
          }
        </QueryState>
      </Card>
      <div className="flex flex-col gap-4">
        <Card variant="outline" className="flex flex-col gap-3 p-4">
          <span className="text-sm font-semibold">Logros</span>
          <QueryState q={medals}>
            {(items) =>
              items.length === 0 ? (
                <span className="text-[13px] text-muted-foreground">
                  Todavía sin medallas.
                </span>
              ) : (
                items.map((m) => {
                  // Con dibujo si tiene clave del catálogo; las viejas, con su emoji.
                  const def = m.medal_key ? catalog.get(m.medal_key) : undefined
                  return (
                    <div
                      key={`${m.title}-${m.icon}-${m.medal_key}-${m.season?.number}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        aria-hidden
                        className="grid size-9 place-items-center rounded-lg bg-primary/12 text-lg"
                      >
                        {def ? (
                          <MedalImage
                            medal={def}
                            season={seasonShort(m.season)}
                            className="h-8 w-auto"
                          />
                        ) : (
                          (m.icon ?? "🏅")
                        )}
                      </span>
                      <span className="flex-1 text-sm font-medium">
                        {m.title}
                      </span>
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        ×{m.count}
                      </span>
                    </div>
                  )
                })
              )
            }
          </QueryState>
        </Card>
        {/* Solo si el admin le hizo algún ajuste (contrato 5). */}
        {adjustments.data && adjustments.data.length > 0 && (
          <Card variant="outline" className="flex flex-col gap-3 p-4">
            <span className="text-sm font-semibold">Ajustes de ELO</span>
            {adjustments.data.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                <span
                  className={cn(
                    "min-w-14 font-mono text-xs font-semibold tabular-nums",
                    a.kind === "set"
                      ? "text-foreground"
                      : a.delta >= 0
                        ? "text-win"
                        : "text-destructive"
                  )}
                >
                  {adjustmentLabel(a)}
                </span>
                <span className="flex-1 text-pretty">{a.reason}</span>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {fmtDay(a.applied_at)}
                </span>
              </div>
            ))}
          </Card>
        )}
        <KeyPlays stats={player.stats} />
      </div>
    </div>
  )
}
