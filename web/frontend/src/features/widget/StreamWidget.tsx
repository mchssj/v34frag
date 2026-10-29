import { cn } from "cn"

import { LevelBadge } from "@/components/brand/LevelBadge"
import { levelOf } from "@/features/matchmaking/room/roomData"
import { LEVEL_FLOORS } from "@/features/player/labels"

// Widget para OBS (docs/bitacora/2026-10-29-widget-streamers en kyan/pruebas). Los datos tienen la
// forma de widget_player(); siempre se dibuja oscuro porque va encima del video del stream.

export type WidgetResult = "V" | "D" | "E"

export interface WidgetData {
  nick: string
  team_tag: string | null
  elo: number
  peak_elo: number
  matches: number
  kd: number | null
  rating: number | null
  hoy: { v: number; d: number; e: number; elo: number; kills: number; deaths: number }
  ultimos: { r: WidgetResult; elo: number | null }[]
}

export type WidgetDesign = "mini" | "compacto" | "completo"
export type WidgetPeriod = "hoy" | "24h"

/** Tamaño de la fuente de navegador en OBS para cada diseño. */
export const WIDGET_SIZE: Record<WidgetDesign, [number, number]> = {
  mini: [170, 64],
  compacto: [360, 150],
  completo: [420, 190],
}

const RESULT_CLASS: Record<WidgetResult, string> = {
  V: "bg-win",
  D: "bg-primary",
  E: "bg-muted-foreground",
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] font-semibold tracking-[0.4px] text-muted-foreground uppercase">
        {label}
      </span>
      <span className={cn("text-[15px] font-bold tabular-nums", className)}>{value}</span>
    </span>
  )
}

export function StreamWidget({
  data,
  design,
  period,
}: {
  data: WidgetData
  design: WidgetDesign
  period: WidgetPeriod
}) {
  const level = levelOf(data.elo, LEVEL_FLOORS)
  const floor = LEVEL_FLOORS[level - 1]!
  const next = level < 10 ? LEVEL_FLOORS[level]! : null
  const pct = next === null ? 100 : Math.min(100, Math.max(0, ((data.elo - floor) / (next - floor)) * 100))
  const when = period === "hoy" ? "hoy" : "24 h"
  const h = data.hoy
  const kd = h.deaths ? (h.kills / h.deaths).toFixed(2) : h.kills ? String(h.kills) : "-"

  return (
    <div
      className={cn(
        "dark inline-flex flex-col gap-2.5 rounded-xl border border-l-[3px] border-white/10 border-l-primary bg-black/80 px-3.5 py-2.5 text-foreground shadow-lg backdrop-blur-sm",
        design === "mini" && "px-3 py-1.5",
        design === "compacto" && "w-[340px]",
        design === "completo" && "w-[400px]"
      )}
    >
      <div className="flex items-center gap-2.5">
        <LevelBadge level={level} size={design === "mini" ? 26 : 30} className="rounded-full" />
        <div className="min-w-0">
          {design !== "mini" && (
            <div className="truncate text-[15px] font-bold">
              {data.team_tag && (
                <span className="mr-1 font-semibold text-muted-foreground">{data.team_tag}</span>
              )}
              {data.nick}
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold tabular-nums">
              {data.elo.toLocaleString("es-AR")}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground">ELO</span>
          </div>
        </div>
      </div>

      {design !== "mini" && (
        <>
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{next === null ? "Nivel 10" : `Nivel ${level} → ${level + 1}`}</span>
              <span>{next === null ? "Nivel máximo" : `faltan ${next - data.elo} ELO`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <Stat label={when} value={`${h.v}V - ${h.d}D${h.e ? ` - ${h.e}E` : ""}`} />
            <Stat
              label={`ELO ${when}`}
              value={signed(h.elo)}
              className={h.elo > 0 ? "text-win" : h.elo < 0 ? "text-primary" : undefined}
            />
            {design === "completo" && (
              <>
                <Stat label={`K/D ${when}`} value={kd} />
                <Stat label="Rating" value={data.rating == null ? "-" : data.rating.toFixed(2)} />
                <Stat label="Pico" value={data.peak_elo.toLocaleString("es-AR")} />
              </>
            )}
          </div>
          {design === "completo" && data.ultimos.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold tracking-[0.4px] text-muted-foreground uppercase">
                Últimos
              </span>
              <span className="flex gap-1">
                {data.ultimos.map((m, i) => (
                  <span
                    key={i}
                    title={m.elo == null ? "Sin ELO" : `${signed(m.elo)} ELO`}
                    className={cn(
                      "grid size-5 place-items-center rounded-[4px] text-[11px] font-extrabold text-background",
                      RESULT_CLASS[m.r]
                    )}
                  >
                    {m.r}
                  </span>
                ))}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
