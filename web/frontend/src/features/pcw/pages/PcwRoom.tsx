import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ArrowLeftIcon, InfoIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MatchRoom } from "@/features/matchmaking/room/MatchRoom"
import { MmSourceContext, type MmSource } from "@/features/matchmaking/source"
import type { MmChatMessage, MmState } from "@/features/matchmaking/types"
import type { SeriesActions } from "../components/MyPcw"
import { DEMO_ME, mapImage } from "../demo"
import { sideName } from "../lib/pcw"
import { pcwToLobby } from "../lib/room"
import {
  banDays,
  MAX_STANDINS,
  MIN_ROSTER,
  NEEDED,
  seriesScore,
  vetoState,
} from "../lib/series"
import type { PcwMatch } from "../types"

/** Puntos de una PCW ganada como equipo (ranking_config.win_pcw, 5 por defecto). */
const WIN_PCW_POINTS = 5

/**
 * La sala de una PCW (bitácora 2026-11-08-pcw-demo): es la misma sala del matchmaking (`MatchRoom`), con los nombres
 * de los equipos, el veto con picks y, arriba del centro, la serie y las reglas de la PCW. La sala le habla a una
 * fuente propia: el veto y el chat van a la demo de PCW.
 */
export function PcwRoom({
  m,
  onBack,
  series,
}: {
  m: PcwMatch
  onBack: () => void
  series: SeriesActions
}) {
  // Caché aparte: lo que la sala guarda del matchmaking no se mezcla con el real.
  const [queryClient] = useState(() => new QueryClient())
  const rival = m.them.roster[0]?.alias ?? sideName(m.them)
  // La fuente (y su chat) se arma una vez por sala; el veto de la demo actualiza con una función, así que no
  // importa que la acción sea la del primer render. La página le da a la sala una key por PCW.
  const [source] = useState(() => pcwRoomSource(m.id, rival, series.onVeto))
  const lobby = pcwToLobby(m, DEMO_ME.id, mapImage)

  return (
    <QueryClientProvider client={queryClient}>
      <MmSourceContext value={source}>
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
            extra={<SeriesCard m={m} series={series} onBack={onBack} />}
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
}: {
  m: PcwMatch
  series: SeriesActions
  onBack: () => void
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
                      : i === maps.length - 1
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
        {b.step === "live" && (
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

/** Lo que la sala del matchmaking le pide a su fuente, resuelto con la demo de PCW. */
function pcwRoomSource(
  matchId: string,
  rival: string,
  onVeto: (id: string, map: string) => void
): MmSource {
  // Las acciones devuelven un estado vacío: la sala se dibuja con la PCW, no con la caché.
  const empty = {} as MmState
  let chat: MmChatMessage[] = [
    {
      id: "c0",
      nick: rival,
      team: null,
      message: "gl hf",
      created_at: new Date().toISOString(),
    },
  ]
  const known: Partial<MmSource> = {
    async veto(_id, map) {
      onVeto(matchId, map)
      return empty
    },
    async chat() {
      return [...chat]
    },
    async sendChat(_id, message, teamOnly) {
      chat = [
        ...chat,
        {
          id: `c${chat.length}`,
          nick: DEMO_ME.alias,
          team: teamOnly ? 1 : null,
          message: message.trim().slice(0, 300),
          created_at: new Date().toISOString(),
        },
      ]
    },
    async report() {
      return empty
    },
    async commend() {
      return empty
    },
    async block() {
      return empty
    },
    async addFriend() {
      return empty
    },
  }
  return new Proxy(known as MmSource, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof MmSource]
      return () =>
        Promise.reject(new Error("No está disponible en la sala de una PCW"))
    },
  })
}
