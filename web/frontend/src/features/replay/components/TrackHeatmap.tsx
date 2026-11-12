import { useMemo, useState } from "react"

import { Segmented } from "@/components/brand/Segmented"
import type { RadarInfo } from "../lib/radar"
import type { NadeKind, Track, TrackPlayer } from "../lib/track"
import { Heatmap } from "./Heatmap"

type Kind = "kills" | "deaths" | "nades"

const KIND_LABEL: Record<Kind, string> = {
  kills: "desde dónde mata",
  deaths: "dónde muere",
  nades: "dónde caen las granadas",
}

const NADE_LABEL: Record<NadeKind | "all", string> = {
  all: "Todas",
  smoke: "Humos",
  flash: "Flashes",
  he: "HE",
}

// Por SteamID: un nick puede cambiar en medio de la partida. Los bots no tienen, van por nick.
const keyOf = (p: Pick<TrackPlayer, "steam" | "name">) =>
  p.steam !== "BOT" && p.steam !== "-" ? p.steam : `bot:${p.name}`

/** Mapa de calor de una partida (sale del .trk): desde dónde mata, dónde muere o dónde caen sus granadas. */
export function TrackHeatmap({
  track,
  radar,
}: {
  track: Track
  radar: RadarInfo
}) {
  const [kind, setKind] = useState<Kind>("kills")
  const [nade, setNade] = useState<NadeKind | "all">("all")
  const [who, setWho] = useState("")
  const people = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of track.rounds)
      for (const p of Object.values(r.players)) m.set(keyOf(p), p.name)
    return [...m].sort((a, b) => a[1].localeCompare(b[1]))
  }, [track])
  const points = useMemo(
    () =>
      track.rounds.flatMap((r) => {
        if (kind === "nades")
          return r.bursts.flatMap((b) =>
            (nade === "all" || b.kind === nade) &&
            (!who || (b.thrower && keyOf(b.thrower) === who))
              ? [{ x: b.x, y: b.y }]
              : []
          )
        return r.kills.flatMap((k) => {
          if (kind === "kills") {
            if (!k.killer || !k.from || (who && keyOf(k.killer) !== who))
              return []
            return [k.from]
          }
          if (who && keyOf(k.victim) !== who) return []
          return [k.at]
        })
      }),
    [track, kind, nade, who]
  )
  const unit =
    kind === "kills" ? "kills" : kind === "deaths" ? "muertes" : "granadas"
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Qué mostrar"
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: "kills", label: "Desde dónde mata" },
            { value: "deaths", label: "Dónde muere" },
            { value: "nades", label: "Granadas" },
          ]}
        />
        {kind === "nades" && (
          <Segmented
            label="Tipo de granada"
            size="sm"
            value={nade}
            onChange={setNade}
            options={(["all", "smoke", "flash", "he"] as const).map((v) => ({
              value: v,
              label: NADE_LABEL[v],
            }))}
          />
        )}
        <select
          aria-label="Jugador"
          value={who}
          onChange={(e) => setWho(e.target.value)}
          className="h-7 rounded-md border bg-card px-2 text-xs"
        >
          <option value="">Todos</option>
          {people.map(([k, name]) => (
            <option key={k} value={k}>
              {name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {points.length} {unit}
        </span>
      </div>
      <Heatmap
        map={track.map}
        radar={radar}
        points={points}
        label={`Mapa de calor de ${track.map}: ${KIND_LABEL[kind]}`}
        className="max-w-[720px]"
      />
    </div>
  )
}
