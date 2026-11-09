import { cn } from "cn"
import {
  BanIcon,
  CopyIcon,
  PlayIcon,
  ServerIcon,
  TrophyIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ConectarHint } from "@/features/matchmaking/ConectarHint"
import {
  cmleagueConnectUrl,
  fmtClock,
  secondsLeft,
} from "@/features/matchmaking/labels"
import { useNow } from "@/features/matchmaking/useNow"
import { mapImage } from "../demo"
import {
  banDays,
  ENTRY_RULE,
  NEEDED,
  seriesScore,
  vetoState,
  waitMinutes,
} from "../lib/series"
import { sideName } from "../lib/pcw"
import type { PcwBooking, PcwMatch } from "../types"

const STEPS = ["Veto", "Servidor", "Entrar", "En juego"] as const
const STEP_OF: Record<PcwBooking["step"], number> = {
  veto: 0,
  queued: 1,
  wait: 2,
  live: 3,
  finished: 4,
  abandoned: -1,
}

/** Lo que pasa después de "los dos listos": veto, fila del servidor, espera para entrar, en juego y abandono. */
export function SeriesPanel({
  m,
  onVeto,
  onUnready,
  onFinishMap,
  onDismiss,
  size = "sm",
}: {
  m: PcwMatch
  onVeto: (map: string) => void
  onUnready: () => void
  onFinishMap: () => void
  onDismiss: () => void
  /** "lg" en la sala de la PCW: mapas más grandes y sin el recuadro. */
  size?: "sm" | "lg"
}) {
  const b = m.booking!
  const now = useNow(b.deadline !== null, 250)
  const left = b.deadline ? secondsLeft(b.deadline, now) : 0
  const veto = vetoState(b.pool, m.best_of, b.actions)
  const rival = sideName(m.them)
  const at = STEP_OF[b.step]
  const [us, them] = seriesScore(b.scores)

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        size === "sm" && "rounded-md border bg-muted/40 p-3"
      )}
    >
      {b.step !== "abandoned" && (
        <ol
          aria-label="Pasos de la serie"
          className="flex flex-wrap gap-1.5 text-[11px]"
        >
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === at ? "step" : undefined}
              className={cn(
                "rounded-full border px-2 py-0.5",
                i < at && "border-win/50 text-win",
                i === at &&
                  "border-primary bg-primary/10 font-semibold text-primary",
                i > at && "text-muted-foreground"
              )}
            >
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      )}

      {b.step === "veto" && (
        <>
          <p className="text-sm">
            {veto.next?.by === "us" ? (
              <b>
                Les toca {veto.next.kind === "ban" ? "banear" : "elegir"} un
                mapa
              </b>
            ) : (
              <>
                <b>{rival}</b> está{" "}
                {veto.next?.kind === "ban" ? "baneando" : "eligiendo"}…
              </>
            )}{" "}
            <span className="font-mono text-muted-foreground tabular-nums">
              {fmtClock(left * 1000)}
            </span>
          </p>
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {b.pool.map((map) => {
              const act = b.actions.find((a) => a.map === map)
              const order = veto.maps.indexOf(map)
              const mine = veto.next?.by === "us" && !act
              const img = mapImage(map)
              return (
                <li key={map}>
                  <button
                    type="button"
                    disabled={!mine}
                    onClick={() => onVeto(map)}
                    aria-label={
                      mine
                        ? `${veto.next!.kind === "ban" ? "Banear" : "Elegir"} ${map}`
                        : map
                    }
                    className={cn(
                      "relative flex w-full items-end overflow-hidden rounded-md border bg-cover bg-center p-1.5 text-left text-xs font-semibold text-white",
                      size === "lg" ? "h-20 sm:text-sm" : "h-14",
                      act?.kind === "ban" && "opacity-35 grayscale",
                      act?.kind === "pick" && "ring-2 ring-primary",
                      mine &&
                        "cursor-pointer hover:ring-2 hover:ring-primary/60"
                    )}
                    // Entre comillas: las fotos de ejemplo son SVG con espacios en la URL.
                    style={
                      img ? { backgroundImage: `url("${img}")` } : undefined
                    }
                  >
                    <span className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                    <span className="relative flex w-full items-center justify-between gap-1">
                      <span className="truncate">
                        {map.replace(/^de_/, "")}
                      </span>
                      {act?.kind === "ban" && (
                        <BanIcon aria-hidden className="size-3" />
                      )}
                      {act?.kind === "pick" && (
                        <span className="text-[10px]">Mapa {order + 1}</span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Cada turno tiene 30 s: si se vence, va un mapa al azar. El que queda
            es el decisivo.
          </p>
        </>
      )}

      {b.step === "queued" && (
        <p className="text-sm">
          <ServerIcon aria-hidden className="mr-1 inline size-4" />
          {b.queue_ahead > 0 ? (
            <>
              <b>En la fila de servidores:</b> {b.queue_ahead} PCW antes. Les
              avisamos con la IP cuando se libere uno.
            </>
          ) : (
            <b>Buscando un servidor libre para PCW…</b>
          )}
        </p>
      )}

      {(b.step === "veto" || b.step === "queued") && (
        <div>
          <Button size="xs" variant="ghost" onClick={onUnready}>
            Ya no estamos listos
          </Button>
          <span className="text-xs text-muted-foreground">
            Sin sanción mientras no haya servidor.
          </span>
        </div>
      )}

      {b.step === "wait" && b.server && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <b>{b.server.name}</b> reservado para toda la serie · mapa{" "}
              {b.map_no}: <b>{veto.maps[b.map_no - 1]}</b>
            </p>
            <span
              aria-label="Tiempo para entrar"
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                left <= 60 && "text-destructive"
              )}
            >
              {fmtClock(left * 1000)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <code className="rounded bg-background px-1.5 py-1">
              connect {b.server.address}; password {b.server.password}
            </code>
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(
                    `connect ${b.server!.address}; password ${b.server!.password}`
                  )
                  .then(() => toast("Copiado: pegalo en la consola"))
              }}
            >
              <CopyIcon />
              Copiar
            </Button>
            <Button size="xs" asChild>
              <a
                href={cmleagueConnectUrl(b.server.address, b.server.password)}
              >
                <PlayIcon />
                Entrar
              </a>
            </Button>
          </div>
          <ConectarHint />
          <Presence label="Ustedes" n={b.present[0]} />
          <Presence label={rival} n={b.present[1]} />
          <p className="text-xs text-muted-foreground">
            Tienen {waitMinutes(b.map_no)} min para entrar: {ENTRY_RULE}. Con
            los dos en regla arranca solo. Si un equipo no llega, pierde por
            abandono: la PCW no cuenta y queda sin PCW {banDays(false)} días (
            {banDays(true)} si se repite en 30).
          </p>
        </>
      )}

      {b.step === "live" && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="live" size="md" shape="pill">
            En vivo
          </Badge>
          <span className="text-sm">
            Mapa {b.map_no} de {m.best_of}: <b>{veto.maps[b.map_no - 1]}</b> ·
            serie{" "}
            <b className="font-mono">
              {us}-{them}
            </b>
          </span>
          <span className="flex-1" />
          <Button size="xs" variant="secondary" onClick={onFinishMap}>
            Simular: termina el mapa
          </Button>
        </div>
      )}

      {b.scores.length > 0 && b.step !== "abandoned" && (
        <ul className="flex flex-col gap-0.5 text-xs">
          {b.scores.map(([a, c], i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">Mapa {i + 1}</span>
              <span>{veto.maps[i]}</span>
              <span
                className={cn(
                  "font-mono",
                  a > c ? "text-win" : "text-destructive"
                )}
              >
                {a}-{c}
              </span>
            </li>
          ))}
        </ul>
      )}

      {b.step === "finished" && (
        <End onDismiss={onDismiss}>
          <TrophyIcon aria-hidden className="inline size-4" />{" "}
          {m.status === "won" ? "Ganaron" : "Perdieron"} la serie{" "}
          <b className="font-mono">
            {us}-{them}
          </b>
          . El servidor quedó libre; la demo y las stats ya están en la partida.
        </End>
      )}

      {b.step === "abandoned" && (
        <End onDismiss={onDismiss}>
          {b.abandoned_by === "them" ? (
            <>
              <b>{rival} no entró a tiempo.</b> La PCW no cuenta para nadie y el
              servidor se liberó. {rival} queda sin PCW {banDays(false)} días.
            </>
          ) : (
            <>
              <b>No llegaron a {NEEDED} adentro a tiempo.</b> La PCW no cuenta y
              quedan sin crear ni aceptar PCW {banDays(false)} días.
            </>
          )}
        </End>
      )}
    </div>
  )
}

function Presence({ label, n }: { label: string; n: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 truncate">{label}</span>
      <Progress
        value={Math.min(100, (n / NEEDED) * 100)}
        aria-label={`${label}: ${n} adentro, mínimo ${NEEDED}`}
        className="h-1.5 flex-1"
      />
      <span className="w-8 text-right font-mono tabular-nums">
        {n} (mín. {NEEDED})
      </span>
    </div>
  )
}

function End({
  children,
  onDismiss,
}: {
  children: React.ReactNode
  onDismiss: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <p className="min-w-[14rem] flex-1">{children}</p>
      <Button size="xs" variant="ghost" onClick={onDismiss}>
        Cerrar
      </Button>
    </div>
  )
}
