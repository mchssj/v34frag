import { useQuery } from "@tanstack/react-query"
import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "cn"
import { QueryState } from "@/components/brand/QueryState"
import { Card } from "@/components/ui/card"
import { KeyPlays } from "../KeyPlays"
import { adjustmentLabel, fmtDay, matchTitle, resultOf } from "../../lib/labels"
import { adjustmentsOptions, recentMatchesOptions } from "../../api/queries"
import type { PlayerDetail } from "../../types"
import { Delta, RESULT_CHIP, useOpenMatch } from "./shared"
import { useMine } from "@/features/ranking/components/parts"
import { ProfileVisitsCard } from "../ProfileVisitsCard"
import type { Tab } from "../../lib/search"
import { ShowcaseCard } from "./ShowcaseTab"
import { BestMapsCard } from "./MapsTab"
import { MedalsCard } from "../MedalsCard"

// ---------- Resumen ----------

export function Summary({
  nick,
  player,
  onTab,
}: {
  nick: string
  player: PlayerDetail
  onTab: (tab: Tab) => void
}) {
  const recent = useQuery(recentMatchesOptions(nick))
  const adjustments = useQuery(adjustmentsOptions(nick))
  const open = useOpenMatch()
  // (replanteo 86) Las visitas solo las ve el dueño, en su propio perfil.
  const own = useMine().playerId === player.id
  const { leftRef, rightRef, side: mapsSide } = useShorterColumn()
  const maps = <BestMapsCard nick={nick} onAll={() => onTab("mapas")} />

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div ref={leftRef} className="flex flex-col gap-4">
          <Card variant="outline" className="overflow-hidden">
            <div className="flex items-center border-b px-4 py-3.5 text-sm font-semibold">
              Partidas recientes
              <button
                type="button"
                onClick={() => onTab("partidas")}
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
                          <span className="truncate font-medium">
                            {t.title}
                          </span>
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
          {/* (replanteo 123) Vitrina: los destacados; todos, en la pestaña Vitrina. */}
          <ShowcaseCard nick={nick} onAll={() => onTab("vitrina")} />
          {/* (replanteo 123) Logros: los elegidos o los de más veces; todos, en la pestaña Logros. */}
          <MedalsCard nick={nick} onAll={() => onTab("logros")} />
        </div>
        {mapsSide === "left" && maps}
      </div>
      <div className="flex flex-col gap-4">
        <div ref={rightRef} className="flex flex-col gap-4">
          {own && <ProfileVisitsCard />}
          {/* Solo si el admin le hizo algún ajuste (contrato 5). */}
          {adjustments.data && adjustments.data.length > 0 && (
            <Card variant="outline" className="flex flex-col gap-3 p-4">
              <span className="text-sm font-semibold">Ajustes de ELO</span>
              {adjustments.data.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2.5 text-[13px]"
                >
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
        {mapsSide === "right" && maps}
      </div>
    </div>
  )
}

/**
 * En qué columna va "Mejores mapas": en la que quede más corta sin ella, para que las dos terminen parejas (lo que
 * ocupa cada una cambia mucho de un jugador a otro: vitrina, logros, visitas, ajustes). Se miden las tarjetas de cada
 * columna sin "Mejores mapas", así moverla no cambia la medida. En una sola columna (teléfono), va a la izquierda,
 * debajo de Logros.
 */
function useShorterColumn() {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState<"left" | "right">("left")
  useLayoutEffect(() => {
    const l = leftRef.current
    const r = rightRef.current
    if (!l || !r || typeof ResizeObserver === "undefined") return
    const measure = () => {
      const lb = l.getBoundingClientRect()
      const rb = r.getBoundingClientRect()
      // Una sola columna (teléfono): la derecha empieza debajo de la izquierda.
      const stacked = rb.top >= lb.bottom
      setSide(!stacked && rb.height < lb.height ? "right" : "left")
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(l)
    ro.observe(r)
    return () => ro.disconnect()
  }, [])
  return { leftRef, rightRef, side }
}
