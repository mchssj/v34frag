import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ArrowLeftIcon, InfoIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MatchRoom } from "@/features/matchmaking/room/MatchRoom"
import { MmSourceContext, type MmSource } from "@/features/matchmaking/source"
import type { SeriesActions } from "../components/MyPcw"
import { pcwToLobby } from "../lib/room"
import {
  banDays,
  fixedMaps,
  MAX_STANDINS,
  MIN_ROSTER,
  NEEDED,
  seriesScore,
  vetoState,
} from "../lib/series"
import type { PcwMatch, PcwPlayer } from "../types"

/** Puntos de una PCW ganada como equipo (ranking_config.win_pcw, 5 por defecto). */
const WIN_PCW_POINTS = 5

/**
 * La sala de una PCW (bitácoras 2026-11-08-pcw-demo y 2026-11-08-pcw-real): es la misma sala del matchmaking
 * (`MatchRoom`), con los nombres de los equipos, el veto con picks y, arriba del centro, la serie y las reglas de la
 * PCW. La sala le habla a una fuente propia (`source`): el veto y el chat van a la API (`PcwLiveRoom`) o a la demo.
 */
export function PcwRoom({
  m,
  onBack,
  series,
  meId,
  mapImage,
  source,
  isCaptain,
  simulate = false,
  refetchMs,
}: {
  m: PcwMatch
  onBack: () => void
  series: SeriesActions
  /** Mi ficha (para marcarme en la sala). */
  meId: string
  mapImage: (name: string) => string | null
  source: MmSource
  isCaptain?: (p: PcwPlayer, team: 1 | 2, i: number) => boolean
  /** La demo: "Simular: termina el mapa". */
  simulate?: boolean
  /** Sin socket, el chat se vuelve a pedir cada tanto. */
  refetchMs?: number
}) {
  // Caché aparte: lo que la sala guarda del matchmaking no se mezcla con el real.
  const [queryClient] = useState(
    () =>
      new QueryClient(
        refetchMs
          ? { defaultOptions: { queries: { refetchInterval: refetchMs } } }
          : undefined
      )
  )
  // La fuente (y el chat de la demo) se arma una vez por sala: la primera que llega. La página le da una key por PCW.
  const [src] = useState(() => source)
  const lobby = pcwToLobby(m, meId, mapImage, isCaptain)

  return (
    <QueryClientProvider client={queryClient}>
      <MmSourceContext value={src}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeftIcon />
              Volver a PCW
            </Button>
            <span className="flex-1" />
            <Badge variant="soft" size="md" shape="pill">
              PCW · no suma ELO
            </Badge>
          </div>
          <MatchRoom
            lobby={lobby}
            extra={
              <SeriesCard
                m={m}
                series={series}
                onBack={onBack}
                simulate={simulate}
              />
            }
          />
        </div>
      </MmSourceContext>
    </QueryClientProvider>
  )
}

/** Arriba del centro de la sala: el marcador de la serie, los mapas y las reglas de la PCW. */
function SeriesCard({
  m,
  series,
  onBack,
  simulate,
}: {
  m: PcwMatch
  series: SeriesActions
  onBack: () => void
  simulate: boolean
}) {
  const b = m.booking!
  const maps = vetoState(b.pool, m.best_of, b.actions).maps
  const [us, them] = seriesScore(b.scores)
  const [rules, setRules] = useState(false)
  const ended = b.step === "finished" || b.step === "abandoned"
  const vetoDone = b.step !== "veto"

  return (
    <section
      aria-label="Serie de la PCW"
      className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          Serie BO{m.best_of}
          {vetoDone && !ended && ` · mapa ${b.map_no}`}
        </h2>
        <span className="font-mono text-lg font-bold tabular-nums">
          {us}-{them}
        </span>
      </div>

      {vetoDone && maps.length > 1 && (
        <ul className="flex flex-col gap-1 text-xs">
          {maps.map((map, i) => {
            const s = b.scores[i]
            return (
              <li key={map} className="flex items-center gap-2">
                <span className="w-12 text-muted-foreground">Mapa {i + 1}</span>
                <span className="flex-1">{map}</span>
                {s ? (
                  <span
                    className={
                      s[0] > s[1]
                        ? "font-mono text-win"
                        : "font-mono text-destructive"
                    }
                  >
                    {s[0]}-{s[1]}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {i + 1 === b.map_no && !ended
                      ? "ahora"
                      : // Con mapas fijos no hay decisivo: se juegan en el orden del anuncio.
                        i === maps.length - 1 && !fixedMaps(b.pool, m.best_of)
                        ? "decisivo"
                        : "—"}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(b.step === "veto" || b.step === "queued") && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              series.onUnready(m.id)
              onBack()
            }}
          >
            Ya no estamos listos
          </Button>
        )}
        {simulate && b.step === "live" && (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => series.onFinishMap(m.id)}
          >
            Simular: termina el mapa
          </Button>
        )}
        {ended && (
          <Button
            size="xs"
            onClick={() => {
              series.onDismiss(m.id)
              onBack()
            }}
          >
            Cerrar la sala
          </Button>
        )}
        <Button
          size="xs"
          variant="ghost"
          aria-expanded={rules}
          onClick={() => setRules((o) => !o)}
        >
          <InfoIcon />
          Reglas de la PCW
        </Button>
      </div>

      {rules && (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
          <li>No suma ni resta ELO a nadie.</li>
          <li>
            {m.us.team
              ? `Si ganan como ${m.us.team.name}, suman ${WIN_PCW_POINTS} puntos al ranking de equipos.`
              : "Es un mix de amigos: no suma al ranking de equipos."}
          </li>
          <li>
            Cada lado juega con al menos {NEEDED} adentro: {MIN_ROSTER} del
            roster que se anotó y hasta {MAX_STANDINS} suplentes, con o sin
            cuenta.
          </li>
          <li>
            El servidor queda reservado para toda la serie: 15 min para entrar
            al primer mapa y 5 a los siguientes.
          </li>
          <li>
            Si un equipo no llega a tiempo, pierde por abandono: la PCW no
            cuenta y queda sin PCW {banDays(false)} días ({banDays(true)} si se
            repite en 30).
          </li>
        </ul>
      )}
    </section>
  )
}
