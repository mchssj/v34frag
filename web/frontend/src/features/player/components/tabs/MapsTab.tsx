import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { MapIcon } from "lucide-react"
import { EmptyState } from "@/components/brand/EmptyState"
import { QueryState } from "@/components/brand/QueryState"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { mapsOptions } from "@/features/maps/api/queries"
import { mapCards, type MapCard } from "../../lib/labels"
import { mapStatsOptions } from "../../api/queries"

// ---------- Mapas ----------

export function Maps({ nick }: { nick: string }) {
  const q = useQuery(mapStatsOptions(nick))
  const catalog = useQuery(mapsOptions).data
  return (
    <QueryState q={q}>
      {(items) => {
        const cards = mapCards(catalog, items)
        if (!cards.length)
          return (
            <Card variant="outline" className="flex min-h-[396px]">
              <EmptyState icon={MapIcon} title="Todavía no jugó mapas">
                Sus estadísticas por mapa aparecen al jugar en el servidor.
              </EmptyState>
            </Card>
          )
        return (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {cards.map((m) => (
              <MapTile key={m.key} map={m} />
            ))}
          </div>
        )
      }}
    </QueryState>
  )
}

/** Un mapa: foto, mapas jugados, % de victorias, K/D y ADR. Sin partidas, atenuado y en cero. */
function MapTile({ map }: { map: MapCard }) {
  const s = map.stat
  const played = (s?.wins ?? 0) + (s?.losses ?? 0)
  const wr = played ? Math.round(((s?.wins ?? 0) / played) * 100) : 0
  const maps = s?.maps ?? played
  return (
    <Card variant="outline" className="flex flex-col overflow-hidden">
      <div
        className={cn(
          "relative h-[72px] border-b bg-cover bg-center",
          !map.image &&
            "bg-[repeating-linear-gradient(135deg,var(--muted)_0_8px,transparent_8px_16px)]",
          !s && "opacity-45 grayscale"
        )}
        style={
          map.image
            ? {
                backgroundImage: `linear-gradient(to top, rgb(0 0 0 / .6), transparent 70%), url(${map.image})`,
              }
            : undefined
        }
      >
        {map.retired && (
          <span className="absolute top-2 left-2.5 inline-flex h-5 items-center rounded-full bg-background/85 px-2 text-[11px] font-semibold text-muted-foreground">
            Retirado
          </span>
        )}
        <span
          className={cn(
            "absolute bottom-2 left-3 font-mono text-sm font-semibold",
            map.image && "text-white"
          )}
        >
          {map.name}
        </span>
        <span
          className={cn(
            "absolute top-2 right-2.5 text-[11.5px]",
            map.image ? "text-white/85" : "text-muted-foreground"
          )}
        >
          {maps} {maps === 1 ? "mapa" : "mapas"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 text-xs">
        <Stat label="% Vict." value={`${wr}%`} muted={!s} />
        <Stat label="K/D" value={(s?.kd ?? 0).toFixed(2)} muted={!s} />
        <Stat label="ADR" value={String(Math.round(s?.adr ?? 0))} muted={!s} />
      </div>
      {!s && (
        <span className="-mt-1 px-3 pb-2.5 text-[11.5px] text-muted-foreground">
          Sin partidas
        </span>
      )}
      <Progress
        value={wr}
        aria-label={`${wr}% de victorias`}
        className="mt-auto h-[3px] rounded-none"
        indicatorClassName={wr >= 50 ? "bg-win" : "bg-muted-foreground"}
      />
    </Card>
  )
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          muted && "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </span>
  )
}

/** Mapas que entran en la tarjeta del Resumen. */
const SUMMARY_MAPS = 3

/** Resumen › Mejores mapas: los 3 más jugados, con victorias, derrotas y rating. */
export function BestMapsCard({
  nick,
  onAll,
}: {
  nick: string
  onAll: () => void
}) {
  const q = useQuery(mapStatsOptions(nick))
  const catalog = useQuery(mapsOptions).data
  return (
    <Card variant="outline" className="flex flex-col gap-3 p-4">
      <div className="flex items-center text-sm font-semibold">
        Mejores mapas
        {(q.data?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={onAll}
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todos los mapas
          </button>
        )}
      </div>
      <QueryState q={q}>
        {(items) => {
          // Los jugados vienen primero, en el orden de la API (por mapas jugados).
          const top = mapCards(catalog, items)
            .filter((m) => m.stat)
            .slice(0, SUMMARY_MAPS)
          if (!top.length)
            return (
              <span className="text-[13px] text-muted-foreground">
                Todavía no jugó mapas en el servidor.
              </span>
            )
          return (
            <ul className="flex flex-col gap-2">
              {top.map((m) => {
                const s = m.stat!
                const played = (s.wins ?? 0) + (s.losses ?? 0)
                const wr = played
                  ? Math.round(((s.wins ?? 0) / played) * 100)
                  : 0
                return (
                  <li
                    key={m.key}
                    className="flex items-center gap-3 overflow-hidden rounded-lg border"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "h-12 w-20 shrink-0 bg-cover bg-center",
                        !m.image &&
                          "bg-[repeating-linear-gradient(135deg,var(--muted)_0_8px,transparent_8px_16px)]"
                      )}
                      style={
                        m.image
                          ? { backgroundImage: `url(${m.image})` }
                          : undefined
                      }
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-mono text-sm font-semibold">
                        {m.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {s.maps ?? played} mapas · {s.wins ?? 0}V{" "}
                        {s.losses ?? 0}D
                      </span>
                    </span>
                    <span className="flex flex-col items-end pr-3">
                      <span
                        className={cn(
                          "font-mono text-sm font-semibold tabular-nums",
                          wr >= 50 ? "text-win" : "text-destructive"
                        )}
                      >
                        {wr}%
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        {s.rating != null
                          ? `Rating ${s.rating.toFixed(2)}`
                          : "—"}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        }}
      </QueryState>
    </Card>
  )
}
