import { useQuery } from "@tanstack/react-query"
import { ArrowRightIcon, UnplugIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { mixStatsOptions } from "@/features/mixes/api/queries"

// ---------- KPIs (los de Mixes) ----------

export function MixKpis() {
  const { data } = useQuery(mixStatsOptions)
  const tiles = [
    {
      label: `Jugadores en los últimos ${data?.window_days ?? 30} días`,
      value: data?.players_recent,
    },
    { label: "Mapa más jugado", value: data && (data.top_map ?? "—") },
    {
      label: "Promedio de rondas",
      value:
        data && (data.avg_rounds === null ? "—" : data.avg_rounds.toFixed(1)),
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
      <LiveKpi count={data?.live_now} />
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgb(0_0_0/.04)]"
        >
          <span className="text-xs text-muted-foreground">{t.label}</span>
          {t.value === undefined ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <span className="font-mono text-[22px] font-semibold tracking-[-0.5px] tabular-nums">
              {t.value}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * KPI "En vivo ahora": con mixes en juego, el punto rojo que late y "Ver" (baja al bloque En vivo
 * de la lista); sin mixes, el enchufe desconectado.
 */
function LiveKpi({ count }: { count: number | undefined }) {
  if (count === undefined)
    return <Skeleton className="col-span-2 h-[74px] rounded-xl md:col-span-1" />
  if (count === 0)
    return (
      <div className="col-span-2 flex items-center gap-3.5 rounded-xl border border-dashed bg-card px-4 py-3.5 md:col-span-1">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <UnplugIcon className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">En vivo ahora</span>
          <span className="text-[15px] font-semibold">Ningún mix en juego</span>
        </span>
      </div>
    )
  return (
    <div className="col-span-2 flex items-center gap-3.5 rounded-xl border border-destructive/45 bg-[color-mix(in_oklch,var(--destructive)_7%,var(--card))] px-4 py-3.5 md:col-span-1">
      <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/16">
        <span
          aria-hidden
          className="absolute size-2.5 animate-ping rounded-full bg-destructive motion-reduce:animate-none"
        />
        <span
          aria-hidden
          className="relative size-2.5 rounded-full bg-destructive"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">En vivo ahora</span>
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[22px] font-semibold tracking-[-0.5px] tabular-nums">
            {count}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {count === 1 ? "mix en juego" : "mixes en juego"}
          </span>
        </span>
      </span>
      <Button
        size="sm"
        className="bg-destructive text-white hover:bg-destructive/85"
        onClick={() =>
          document
            .getElementById("lista-partidas")
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      >
        Ver
        <ArrowRightIcon aria-hidden />
      </Button>
    </div>
  )
}
